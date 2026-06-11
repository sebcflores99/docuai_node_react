import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`docu-ai-backend listening on port ${env.port} [${env.nodeEnv}]`);
});
