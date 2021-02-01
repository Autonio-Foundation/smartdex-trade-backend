import { EntitySchema } from 'typeorm';

import { WMATICvUSDCOrder } from '../models/WMATICvUSDCOrder';

export const WMATICvUSDCOrderEntity = new EntitySchema<WMATICvUSDCOrder>({
    name: 'WMATICvUSDCOrder',
    target: WMATICvUSDCOrder,
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
        status: {
            type: 'varchar'
        }
    },
});
