import { EntitySchema } from 'typeorm';

import { MaticOHLVC } from '../models/MaticOHLVC';

export const maticOHLVCEntity = new EntitySchema<MaticOHLVC>({
    name: 'MaticOHLVC',
    target: MaticOHLVC,
    columns: {
        hash: {
            primary: true,
            type: 'varchar',
        },
        dt: {
            type: 'Date',
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
