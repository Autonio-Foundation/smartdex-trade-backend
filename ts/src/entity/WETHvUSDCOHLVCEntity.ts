import { EntitySchema } from 'typeorm';

import { WETHvUSDCOHLVC } from '../models/WETHvUSDCOHLVC';

export const WETHvUSDCOHLVCEntity = new EntitySchema<WETHvUSDCOHLVC>({
    name: 'WETHvUSDCOHLVC',
    target: WETHvUSDCOHLVC,
    columns: {
        dt: {
            primary: true,
            type: 'int',
        },
        bid: {
            type: 'int',
        },
        ask: {
            type: 'int',
        },
        bid_vol: {
            type: 'int',
        },
        ask_vol: {
            type: 'int',
        },
        avg_price: {
            type: 'int'
        }
    },
});
