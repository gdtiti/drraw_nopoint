import _ from 'lodash';

import Request from '@/lib/request/Request.ts';
import { getTokenLiveStatus, tokenSplit } from '@/api/controllers/core.ts';
import logger from '@/lib/logger.ts';

export default {

    prefix: '/token',

    post: {

        '/check': async (request: Request) => {
            request
                .validate('body.token', _.isString)
            const live = await getTokenLiveStatus(request.body.token);
            return {
                live
            }
        },

        // 积分相关路由已移除（/points 和 /receive）

    }

}
