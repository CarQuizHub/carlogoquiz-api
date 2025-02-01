import router from './utils/router'; // Import router from utils folder
import { Env } from './durable-objects/session'; // Import environment types from durable-objects

export default {
	fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
		return router.handle(request, env);
	},
};
