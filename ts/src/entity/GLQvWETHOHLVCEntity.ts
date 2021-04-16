import { EntitySchema } from 'typeorm';

import { GLQvWETHOHLVC } from '../models/GLQvWETHOHLVC';

export const GLQvWETHOHLVCEntity = new EntitySchema<GLQvWETHOHLVC>({
    name: 'GLQvWETHOHLVC',
    target: GLQvWETHOHLVC,
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
