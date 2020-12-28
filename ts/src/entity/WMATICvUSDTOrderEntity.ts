import { EntitySchema } from 'typeorm';

import { WMATICvUSDTOrder } from '../models/WMATICvUSDTOrder';

export const WMATICvUSDTOrderEntity = new EntitySchema<WMATICvUSDTOrder>({
    name: 'WMATICvUSDTOrder',
    target: WMATICvUSDTOrder,
    columns: {
        hash: {
            primary: true,
            type: 'varchar',
        },
        senderAddress: {
            type: 'varchar',
        },
        makerAddress: {
            type: 'varchar',
        },
        takerAddress: {
            type: 'varchar',
        },
        makerAssetData: {
            type: 'varchar',
        },
        takerAssetData: {
            type: 'varchar',
        },
        exchangeAddress: {
            type: 'varchar',
        },
        feeRecipientAddress: {
            type: 'varchar',
        },
        expirationTimeSeconds: {
            type: 'int',
        },
        makerFee: {
            type: 'varchar',
        },
        takerFee: {
            type: 'varchar',
        },
        makerAssetAmount: {
            type: 'varchar',
        },
        takerAssetAmount: {
            type: 'varchar',
        },
        salt: {
            type: 'varchar',
        },
        signature: {
            type: 'varchar',
        },
    },
});
