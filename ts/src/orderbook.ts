import {
    assetDataUtils,
    BigNumber,
    ContractWrappers,
    orderHashUtils,
    RPCSubprovider,
    SignedOrder,
    Web3ProviderEngine,
} from '0x.js';
import { APIOrder, OrderbookResponse, PaginatedCollection } from '@0x/connect';
import { OrderState, OrderWatcher } from '@0x/order-watcher';
import { Asset, AssetPairsItem, AssetProxyId, OrdersRequestOpts } from '@0x/types';
import { errorUtils, intervalUtils } from '@0x/utils';
import * as _ from 'lodash';

import {
    DEFAULT_ERC20_TOKEN_PRECISION,
    DEFAULT_TAKER_SIMULATION_ADDRESS,
    NETWORK_ID,
    ORDER_SHADOWING_MARGIN_MS,
    PERMANENT_CLEANUP_INTERVAL_MS,
    RPC_URL,
} from './config';
import { MAX_TOKEN_SUPPLY_POSSIBLE } from './constants';
import { getDBConnection } from './db_connection';
import { NIOXvUSDTOHLVC } from './models/NIOXvUSDTOHLVC';
import { NIOXvUSDTOrder } from './models/NIOXvUSDTOrder';
import { WMATICvUSDTOHLVC } from './models/WMATICvUSDTOHLVC';
import { WMATICvUSDTOrder } from './models/WMATICvUSDTOrder';
import { SignedOrderModel } from './models/SignedOrderModel';
import { paginate } from './paginator';
import { utils } from './utils';
import { TOKEN_ADDRESSES } from './config';
import { Between, LessThan } from "typeorm";

interface GetOHLVCDataParams {
    base_token: string,
    quote_token: string,
    from: string,
    to: string,
    interval: string,
}

interface GetPrevMarketPriceParams {
    base_token: string,
    quote_token: string,
}

interface GetOrderHistoryParams {
    base_token: string,
    quote_token: string,
    address: string
}

export class OHLVCData {
    public time?: number;
    public low?: number;
    public high?: number;
    public open?: number;
    public close?: number;
    public volume?: number;
}

export class OrderBook {
    private readonly _orderWatcher: OrderWatcher;
    private readonly _contractWrappers: ContractWrappers;
    // Mapping from an order hash to the timestamp when it was shadowed
    private readonly _shadowedOrders: Map<string, number>;
    public static async getOrderByHashIfExistsAsync(orderHash: string): Promise<APIOrder | undefined> {
        const connection = getDBConnection();
        const signedOrderModelIfExists = await connection.manager.findOne(SignedOrderModel, orderHash);
        if (signedOrderModelIfExists === undefined) {
            return undefined;
        } else {
            const deserializedOrder = deserializeOrder(signedOrderModelIfExists as Required<SignedOrderModel>);
            return { metaData: {}, order: deserializedOrder };
        }
    }
    public static async getAssetPairsAsync(
        page: number,
        perPage: number,
        assetDataA: string,
        assetDataB: string,
    ): Promise<PaginatedCollection<AssetPairsItem>> {
        const connection = getDBConnection();
        const signedOrderModels = (await connection.manager.find(SignedOrderModel)) as Array<
            Required<SignedOrderModel>
        >;
        const erc721AssetDataToAsset = (assetData: string): Asset => {
            const asset: Asset = {
                minAmount: new BigNumber(0),
                maxAmount: new BigNumber(1),
                precision: 0,
                assetData,
            };
            return asset;
        };
        const erc20AssetDataToAsset = (assetData: string): Asset => {
            const asset: Asset = {
                minAmount: new BigNumber(0),
                maxAmount: MAX_TOKEN_SUPPLY_POSSIBLE,
                precision: DEFAULT_ERC20_TOKEN_PRECISION,
                assetData,
            };
            return asset;
        };
        const assetDataToAsset = (assetData: string): Asset => {
            const assetProxyId = assetDataUtils.decodeAssetProxyId(assetData);
            let asset: Asset;
            switch (assetProxyId) {
                case AssetProxyId.ERC20:
                    asset = erc20AssetDataToAsset(assetData);
                    break;
                case AssetProxyId.ERC721:
                    asset = erc721AssetDataToAsset(assetData);
                    break;
                default:
                    throw errorUtils.spawnSwitchErr('assetProxyId', assetProxyId);
            }
            return asset;
        };
        const signedOrderToAssetPair = (signedOrder: SignedOrder): AssetPairsItem => {
            return {
                assetDataA: assetDataToAsset(signedOrder.makerAssetData),
                assetDataB: assetDataToAsset(signedOrder.takerAssetData),
            };
        };
        const assetPairsItems: AssetPairsItem[] = signedOrderModels.map(deserializeOrder).map(signedOrderToAssetPair);
        let nonPaginatedFilteredAssetPairs: AssetPairsItem[];
        if (assetDataA === undefined && assetDataB === undefined) {
            nonPaginatedFilteredAssetPairs = assetPairsItems;
        } else if (assetDataA !== undefined && assetDataB !== undefined) {
            const containsAssetDataAAndAssetDataB = (assetPair: AssetPairsItem) =>
                (assetPair.assetDataA.assetData === assetDataA && assetPair.assetDataB.assetData === assetDataB) ||
                (assetPair.assetDataA.assetData === assetDataB && assetPair.assetDataB.assetData === assetDataA);
            nonPaginatedFilteredAssetPairs = assetPairsItems.filter(containsAssetDataAAndAssetDataB);
        } else {
            const assetData = assetDataA || assetDataB;
            const containsAssetData = (assetPair: AssetPairsItem) =>
                assetPair.assetDataA.assetData === assetData || assetPair.assetDataB.assetData === assetData;
            nonPaginatedFilteredAssetPairs = assetPairsItems.filter(containsAssetData);
        }
        const uniqueNonPaginatedFilteredAssetPairs = _.uniqWith(nonPaginatedFilteredAssetPairs, _.isEqual.bind(_));
        const paginatedFilteredAssetPairs = paginate(uniqueNonPaginatedFilteredAssetPairs, page, perPage);
        return paginatedFilteredAssetPairs;
    }
    constructor() {
        const provider = new Web3ProviderEngine();
        provider.addProvider(new RPCSubprovider(RPC_URL));
        provider.start();

        this._shadowedOrders = new Map();
        this._contractWrappers = new ContractWrappers(provider, {
            networkId: NETWORK_ID,
        });
        this._orderWatcher = new OrderWatcher(provider, NETWORK_ID);
        this._orderWatcher.subscribe(this.onOrderStateChangeCallback.bind(this));
        intervalUtils.setAsyncExcludingInterval(
            this.onCleanUpInvalidOrdersAsync.bind(this),
            PERMANENT_CLEANUP_INTERVAL_MS,
            utils.log,
        );
    }
    public onOrderStateChangeCallback(err: Error | null, orderState?: OrderState): void {
        if (err !== null) {
            utils.log(err);
        } else {
            const state = orderState as OrderState;
            if (!state.isValid) {
                this._shadowedOrders.set(state.orderHash, Date.now());
                if (state.error === 'ORDER_CANCELLED') {
                    // Canceled Order
                    this.addOrderHistoryAsync(state.orderHash,'Canceled');
                }
                else {
                    this.addOrderHistoryAsync(state.orderHash,'Executed');
                }
            } else {
                this._shadowedOrders.delete(state.orderHash);
            }
        }
    }
    public async onCleanUpInvalidOrdersAsync(): Promise<void> {
        const permanentlyExpiredOrders: string[] = [];
        for (const [orderHash, shadowedAt] of this._shadowedOrders) {
            const now = Date.now();
            if (shadowedAt + ORDER_SHADOWING_MARGIN_MS < now) {
                await this.addOrderHistoryAsync(orderHash, 'Executed');
                permanentlyExpiredOrders.push(orderHash);
                this._shadowedOrders.delete(orderHash); // we need to remove this order so we don't keep shadowing it
                this._orderWatcher.removeOrder(orderHash); // also remove from order watcher to avoid more callbacks
            }
        }
        if (!_.isEmpty(permanentlyExpiredOrders)) {
            const connection = getDBConnection();
            await connection.manager.delete(SignedOrderModel, permanentlyExpiredOrders);
        }
    }
    public async addOHLVCAsync(entity: any): Promise<void> {
        const connection = getDBConnection();
        const params = {
            dt: entity.dt,
            bid: entity.bid,
            ask: entity.bid,
            bid_vol: entity.bid_vol,
            ask_vol: entity.ask_vol,
        };
        if (entity.base_token === 'niox' && entity.quote_token === 'usdt') {
            await connection.manager.save(new NIOXvUSDTOHLVC(params));
        }
        else if (entity.base_token === 'wmatic' && entity.quote_token === 'usdt') {
            await connection.manager.save(new WMATICvUSDTOHLVC(params));
        }
    }
    public async addOrderAsync(signedOrder: SignedOrder): Promise<void> {
        const connection = getDBConnection();
        // Validate transfers to a non 0 default address. Some tokens cannot be transferred to
        // the null address (default)
        await this._contractWrappers.exchange.validateOrderFillableOrThrowAsync(signedOrder, {
            simulationTakerAddress: DEFAULT_TAKER_SIMULATION_ADDRESS,
        });
        await this._orderWatcher.addOrderAsync(signedOrder);
        const signedOrderModel = serializeOrder(signedOrder);
        await connection.manager.save(signedOrderModel);
    }
    public async getOrderBookAsync(
        page: number,
        perPage: number,
        baseAssetData: string,
        quoteAssetData: string,
    ): Promise<OrderbookResponse> {
        const connection = getDBConnection();
        const bidSignedOrderModels = (await connection.manager.find(SignedOrderModel, {
            where: { takerAssetData: baseAssetData, makerAssetData: quoteAssetData },
        })) as Array<Required<SignedOrderModel>>;
        const askSignedOrderModels = (await connection.manager.find(SignedOrderModel, {
            where: { takerAssetData: quoteAssetData, makerAssetData: baseAssetData },
        })) as Array<Required<SignedOrderModel>>;
        const bidApiOrders: APIOrder[] = bidSignedOrderModels
            .map(deserializeOrder)
            .filter(order => !this._shadowedOrders.has(orderHashUtils.getOrderHashHex(order)))
            .sort((orderA, orderB) => compareBidOrder(orderA, orderB))
            .map(signedOrder => ({ metaData: {}, order: signedOrder }));
        const askApiOrders: APIOrder[] = askSignedOrderModels
            .map(deserializeOrder)
            .filter(order => !this._shadowedOrders.has(orderHashUtils.getOrderHashHex(order)))
            .sort((orderA, orderB) => compareAskOrder(orderA, orderB))
            .map(signedOrder => ({ metaData: {}, order: signedOrder }));
        const paginatedBidApiOrders = paginate(bidApiOrders, page, perPage);
        const paginatedAskApiOrders = paginate(askApiOrders, page, perPage);
        return {
            bids: paginatedBidApiOrders,
            asks: paginatedAskApiOrders,
        };
    }
    // TODO:(leo) Do all filtering and pagination in a DB (requires stored procedures or redundant fields)
    public async getOrdersAsync(
        page: number,
        perPage: number,
        ordersFilterParams: OrdersRequestOpts,
    ): Promise<PaginatedCollection<APIOrder>> {
        const connection = getDBConnection();
        // Pre-filters
        const filterObjectWithValuesIfExist: Partial<SignedOrder> = {
            exchangeAddress: ordersFilterParams.exchangeAddress,
            senderAddress: ordersFilterParams.senderAddress,
            makerAssetData: ordersFilterParams.makerAssetData,
            takerAssetData: ordersFilterParams.takerAssetData,
            makerAddress: ordersFilterParams.makerAddress,
            takerAddress: ordersFilterParams.takerAddress,
            feeRecipientAddress: ordersFilterParams.feeRecipientAddress,
        };
        const filterObject = _.pickBy(filterObjectWithValuesIfExist, _.identity.bind(_));
        const signedOrderModels = (await connection.manager.find(SignedOrderModel, { where: filterObject })) as Array<
            Required<SignedOrderModel>
        >;
        let signedOrders = _.map(signedOrderModels, deserializeOrder);
        // Post-filters
        signedOrders = signedOrders
            .filter(order => !this._shadowedOrders.has(orderHashUtils.getOrderHashHex(order)))
            .filter(
                // traderAddress
                signedOrder =>
                    ordersFilterParams.traderAddress === undefined ||
                    signedOrder.makerAddress === ordersFilterParams.traderAddress ||
                    signedOrder.takerAddress === ordersFilterParams.traderAddress,
            )
            .filter(
                // makerAssetAddress
                signedOrder =>
                    ordersFilterParams.makerAssetAddress === undefined ||
                    includesTokenAddress(signedOrder.makerAssetData, ordersFilterParams.makerAssetAddress),
            )
            .filter(
                // takerAssetAddress
                signedOrder =>
                    ordersFilterParams.takerAssetAddress === undefined ||
                    includesTokenAddress(signedOrder.takerAssetData, ordersFilterParams.takerAssetAddress),
            )
            .filter(
                // makerAssetProxyId
                signedOrder =>
                    ordersFilterParams.makerAssetProxyId === undefined ||
                    assetDataUtils.decodeAssetDataOrThrow(signedOrder.makerAssetData).assetProxyId ===
                        ordersFilterParams.makerAssetProxyId,
            )
            .filter(
                // makerAssetProxyId
                signedOrder =>
                    ordersFilterParams.takerAssetProxyId === undefined ||
                    assetDataUtils.decodeAssetDataOrThrow(signedOrder.takerAssetData).assetProxyId ===
                        ordersFilterParams.takerAssetProxyId,
            );
        const apiOrders: APIOrder[] = signedOrders.map(signedOrder => ({ metaData: {}, order: signedOrder }));
        const paginatedApiOrders = paginate(apiOrders, page, perPage);
        return paginatedApiOrders;
    }
    public async addExistingOrdersToOrderWatcherAsync(): Promise<void> {
        const connection = getDBConnection();
        const signedOrderModels = (await connection.manager.find(SignedOrderModel)) as Array<
            Required<SignedOrderModel>
        >;
        const signedOrders = signedOrderModels.map(deserializeOrder);
        for (const signedOrder of signedOrders) {
            try {
                await this._contractWrappers.exchange.validateOrderFillableOrThrowAsync(signedOrder, {
                    simulationTakerAddress: DEFAULT_TAKER_SIMULATION_ADDRESS,
                });
                await this._orderWatcher.addOrderAsync(signedOrder);
            } catch (err) {
                const orderHash = orderHashUtils.getOrderHashHex(signedOrder);
                await this.addOrderHistoryAsync(orderHash, 'Canceled');
                await connection.manager.delete(SignedOrderModel, orderHash);
            }
        }
    }
    public async addOrderHistoryAsync(orderHash: string, status: string): Promise<void> {
        const orderByHash = await OrderBook.getOrderByHashIfExistsAsync(orderHash);
        if (orderByHash !== undefined) {
            const { order } = orderByHash;
            const connection = getDBConnection();
            const serializedOrder = {
                ...order,
                hash: orderHash,
                status: status,
                makerFee: order.makerFee.toString(),
                takerFee: order.takerFee.toString(),
                makerAssetAmount: order.makerAssetAmount.toString(),
                takerAssetAmount: order.takerAssetAmount.toString(),
                salt: order.salt.toString(),
                exchangeAddress: order.exchangeAddress,
                feeRecipientAddress: order.feeRecipientAddress,
                expirationTimeSeconds: order.expirationTimeSeconds.toNumber(),
        
            }

            const nioxAssetData = assetDataUtils.encodeERC20AssetData(TOKEN_ADDRESSES.niox);
            const usdtAssetData = assetDataUtils.encodeERC20AssetData(TOKEN_ADDRESSES.usdt);
            // const wmaticAssetData = assetDataUtils.encodeERC20AssetData(TOKEN_ADDRESSES.wmatic);
        
            if ((order.makerAssetData === nioxAssetData && order.takerAssetData === usdtAssetData) || 
            (order.makerAssetData === usdtAssetData && order.takerAssetData === nioxAssetData)) {
                // NIOX/USDT pair
                await connection.manager.save(new NIOXvUSDTOrder(serializedOrder));
            }
            else {
                // WMATIC/USDT pair
                await connection.manager.save(new WMATICvUSDTOrder(serializedOrder));
            }
        }
    }
    public async getOrderHistoryAsync(params: GetOrderHistoryParams): Promise<Array<any>> {
        var res : Array<any> = [];
        const connection = getDBConnection();
        if (params.base_token === 'niox' && params.quote_token === 'usdt') {
            res = (await connection.manager.find(NIOXvUSDTOrder, { where: { makerAddress: params.address}, order: { salt: "DESC"} })) as Array<Required<NIOXvUSDTOrder>>;
        }
        else if (params.base_token === 'wmatic' && params.quote_token === 'usdt') {
            res = (await connection.manager.find(WMATICvUSDTOrder, { where: { makerAddress: params.address}, order: { salt: "DESC"} })) as Array<Required<WMATICvUSDTOrder>>;
        }
        return res;
    }
    public async getPrevMarketPriceAsync(params: GetPrevMarketPriceParams): Promise<any> {
        var ohlvcData : Array<any> = [];
        var dateNow = new Date();
        dateNow.setDate(dateNow.getDate() - 1);
        const connection = getDBConnection();
        if (params.base_token === 'niox' && params.quote_token === 'usdt') {
            ohlvcData = (await connection.manager.find(NIOXvUSDTOHLVC, {
                where: { dt: LessThan(dateNow.getTime()) }, 
                order: { dt: "DESC"}
            })) as Array<Required<NIOXvUSDTOHLVC>>;
        }
        else if (params.base_token === 'wmatic' && params.quote_token === 'usdt') {
            ohlvcData = (await connection.manager.find(WMATICvUSDTOHLVC, {
                where: { dt: LessThan(dateNow.getTime()) }, 
                order: { dt: "DESC"}
            })) as Array<Required<WMATICvUSDTOHLVC>>;
        }
        if (ohlvcData.length === 0) {
            return {prevPrice: 0};
        }
        return {prevPrice: ohlvcData[0].bid};
}
    public async getAllOrderHistoryAsync(
        page: number,
        perPage: number,
        base_token: string,
        quote_token: string,
    ): Promise<any> {
        var res : Array<any> = [];
        const connection = getDBConnection();
        if (base_token === 'niox' && quote_token === 'usdt') {
            res = (await connection.manager.find(NIOXvUSDTOrder, {
                order: { salt: "DESC"}
            })) as Array<Required<NIOXvUSDTOrder>>;
        }
        else {
            res = (await connection.manager.find(WMATICvUSDTOrder, {
                order: { salt: "DESC"}
            })) as Array<Required<NIOXvUSDTOrder>>;
        }
        const apiOrders: any[] = res
            .map(signedOrder => ({
                signature: signedOrder.signature,
                senderAddress: signedOrder.senderAddress,
                makerAddress: signedOrder.makerAddress,
                takerAddress: signedOrder.takerAddress,
                makerFee: new BigNumber(signedOrder.makerFee),
                takerFee: new BigNumber(signedOrder.takerFee),
                makerAssetAmount: new BigNumber(signedOrder.makerAssetAmount),
                takerAssetAmount: new BigNumber(signedOrder.takerAssetAmount),
                makerAssetData: signedOrder.makerAssetData,
                takerAssetData: signedOrder.takerAssetData,
                salt: new BigNumber(signedOrder.salt),
                exchangeAddress: signedOrder.exchangeAddress,
                feeRecipientAddress: signedOrder.feeRecipientAddress,
                expirationTimeSeconds: new BigNumber(signedOrder.expirationTimeSeconds),
                status: signedOrder.status
            }))
            .map(signedOrder => ({ metaData: {}, order: signedOrder }));
        const paginatedApiOrderHistory = paginate(apiOrders, page, perPage);
        return paginatedApiOrderHistory;
    }
    public async getOHLVCDataAsync(params: GetOHLVCDataParams): Promise<Array<OHLVCData>> {
        var res : Array<OHLVCData> = [];
        const connection = getDBConnection();
        let params_from = parseInt(params.from);
        let params_to = parseInt(params.to);
        let params_interval = parseInt(params.interval);
        let ohlvcEntity: any[] = [];
        if (params.base_token === 'niox' && params.quote_token === 'usdt') {
            ohlvcEntity = (await connection.manager.find(NIOXvUSDTOHLVC, { 
                where: { dt: Between(params_from, params_to) }, 
                order: { dt: "ASC"}
            })) as Array<Required<NIOXvUSDTOHLVC>>;
        }
        else if (params.base_token === 'wmatic' && params.quote_token === 'usdt') {
            ohlvcEntity = (await connection.manager.find(WMATICvUSDTOHLVC, { 
                where: { dt: Between(params_from, params_to) },
                order: { dt: "ASC"}
            })) as Array<Required<WMATICvUSDTOHLVC>>;
        }
        if (ohlvcEntity.length === 0) {
            return [];
        }
        params_from = ohlvcEntity[0].dt;
        let curDate = new Date();
        if (params_to < curDate.getTime()) {
            params_to = curDate.getTime();
        }
        for (let i = params_from ; i < params_to ; i += params_interval) {
            var newData = new OHLVCData();
            newData.time = i;
            newData.open = 0;
            newData.close = 0;
            newData.high = 0;
            newData.low = 10000000000000;
            newData.volume = 0;
            res.push(newData);
        }
        res[0].open = ohlvcEntity[0].bid;
        res[0].close = ohlvcEntity[0].bid;
        res[0].high = ohlvcEntity[0].bid;
        res[0].low = ohlvcEntity[0].bid;
        let curId = 0;
        let high = 0;
        let low = 0;
        ohlvcEntity.forEach(entity => {
            let id = Math.floor((entity.dt - params_from) / params_interval);
            if (curId != id) {
                for(let i = curId + 1 ; i <= id ; i ++) {
                    res[i].open = res[curId].close;
                    res[i].close = res[curId].close;
                    res[i].high = res[curId].close;
                    res[i].low = res[curId].close;
                }
                res[id].volume = 0;
                high = entity.bid;
                low = entity.bid;
                curId = id;
            }
            res[id].close = entity.bid;

            if (high < entity.bid) {
                high = entity.bid;
            }
            if (low > entity.bid) {
                low = entity.bid;
            }

            res[id].volume += entity.bid_vol + entity.ask_vol;
            res[id].high = high;
            res[id].low = low;
        })
        for (let i = curId + 1 ; i < res.length ; i ++) {
            res[i].open = res[curId].close;
            res[i].close = res[curId].close;
            res[i].high = res[curId].close;
            res[i].low = res[curId].close;
        }
        return res;
    }
}

const compareAskOrder = (orderA: SignedOrder, orderB: SignedOrder): number => {
    const orderAPrice = orderA.takerAssetAmount.div(orderA.makerAssetAmount);
    const orderBPrice = orderB.takerAssetAmount.div(orderB.makerAssetAmount);
    if (!orderAPrice.isEqualTo(orderBPrice)) {
        return orderAPrice.comparedTo(orderBPrice);
    }

    return compareOrderByFeeRatio(orderA, orderB);
};

const compareBidOrder = (orderA: SignedOrder, orderB: SignedOrder): number => {
    const orderAPrice = orderA.makerAssetAmount.div(orderA.takerAssetAmount);
    const orderBPrice = orderB.makerAssetAmount.div(orderB.takerAssetAmount);
    if (!orderAPrice.isEqualTo(orderBPrice)) {
        return orderBPrice.comparedTo(orderAPrice);
    }

    return compareOrderByFeeRatio(orderA, orderB);
};

const compareOrderByFeeRatio = (orderA: SignedOrder, orderB: SignedOrder): number => {
    const orderAFeePrice = orderA.takerFee.div(orderA.takerAssetAmount);
    const orderBFeePrice = orderB.takerFee.div(orderB.takerAssetAmount);
    if (!orderAFeePrice.isEqualTo(orderBFeePrice)) {
        return orderBFeePrice.comparedTo(orderAFeePrice);
    }

    return orderA.expirationTimeSeconds.comparedTo(orderB.expirationTimeSeconds);
};

const includesTokenAddress = (assetData: string, tokenAddress: string): boolean => {
    const decodedAssetData = assetDataUtils.decodeAssetDataOrThrow(assetData);
    if (assetDataUtils.isMultiAssetData(decodedAssetData)) {
        for (const [, nestedAssetDataElement] of decodedAssetData.nestedAssetData.entries()) {
            if (includesTokenAddress(nestedAssetDataElement, tokenAddress)) {
                return true;
            }
        }
        return false;
    } else if (!assetDataUtils.isStaticCallAssetData(decodedAssetData)) {
        return decodedAssetData.tokenAddress === tokenAddress;
    }
    return false;
};

const deserializeOrder = (signedOrderModel: Required<SignedOrderModel>): SignedOrder => {
    const signedOrder: SignedOrder = {
        signature: signedOrderModel.signature,
        senderAddress: signedOrderModel.senderAddress,
        makerAddress: signedOrderModel.makerAddress,
        takerAddress: signedOrderModel.takerAddress,
        makerFee: new BigNumber(signedOrderModel.makerFee),
        takerFee: new BigNumber(signedOrderModel.takerFee),
        makerAssetAmount: new BigNumber(signedOrderModel.makerAssetAmount),
        takerAssetAmount: new BigNumber(signedOrderModel.takerAssetAmount),
        makerAssetData: signedOrderModel.makerAssetData,
        takerAssetData: signedOrderModel.takerAssetData,
        salt: new BigNumber(signedOrderModel.salt),
        exchangeAddress: signedOrderModel.exchangeAddress,
        feeRecipientAddress: signedOrderModel.feeRecipientAddress,
        expirationTimeSeconds: new BigNumber(signedOrderModel.expirationTimeSeconds),
    };
    return signedOrder;
};

const serializeOrder = (signedOrder: SignedOrder): SignedOrderModel => {
    const signedOrderModel = new SignedOrderModel({
        signature: signedOrder.signature,
        senderAddress: signedOrder.senderAddress,
        makerAddress: signedOrder.makerAddress,
        takerAddress: signedOrder.takerAddress,
        makerFee: signedOrder.makerFee.toString(),
        takerFee: signedOrder.takerFee.toString(),
        makerAssetAmount: signedOrder.makerAssetAmount.toString(),
        takerAssetAmount: signedOrder.takerAssetAmount.toString(),
        makerAssetData: signedOrder.makerAssetData,
        takerAssetData: signedOrder.takerAssetData,
        salt: signedOrder.salt.toString(),
        exchangeAddress: signedOrder.exchangeAddress,
        feeRecipientAddress: signedOrder.feeRecipientAddress,
        expirationTimeSeconds: signedOrder.expirationTimeSeconds.toNumber(),
        hash: orderHashUtils.getOrderHashHex(signedOrder),
    });
    return signedOrderModel;
};
