import {defineHandler} from 'nitro/h3';
import {fetchNodeHandler} from 'srvx/node';
import {handleFoundryApi} from '../../../../server/foundry/api.ts';
export default defineHandler(event=>fetchNodeHandler(handleFoundryApi,event.req));
