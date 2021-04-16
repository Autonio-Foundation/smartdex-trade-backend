import { EntitySchema } from 'typeorm';

import { ALOHAvNIOXOHLVC } from '../models/ALOHAvNIOXOHLVC';

export const ALOHAvNIOXOHLVCEntity = new EntitySchema<ALOHAvNIOXOHLVC>({
    name: 'ALOHAvNIOXOHLVC',
    target: ALOHAvNIOXOHLVC,
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
