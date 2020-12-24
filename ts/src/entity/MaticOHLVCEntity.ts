import { EntitySchema } from 'typeorm';

import { MaticOHLVC } from '../models/MaticOHLVC';

export const maticOHLVCEntity = new EntitySchema<MaticOHLVC>({
    name: 'MaticOHLVC',
    target: MaticOHLVC,
    columns: {
        dt: {
            primary: true,
            type: 'int',
        },
        base_token: {
            type: 'varchar'
        },
        quote_token: {
            type: 'varchar'
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
    },
});
