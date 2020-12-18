import { EntitySchema } from 'typeorm';

import { MaticOHLVC } from '../models/MaticOHLVC';

export const maticOHLVCEntity = new EntitySchema<MaticOHLVC>({
    name: 'MaticOHLVC',
    target: MaticOHLVC,
    columns: {
        dt: {
            primary: true,
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
