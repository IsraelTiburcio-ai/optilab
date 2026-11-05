import type {IncomingMessage,ServerResponse} from 'node:http';
import {vercelHandler} from '../../server/academic/vercel';
export default async function handler(req:IncomingMessage,res:ServerResponse):Promise<void> {
  await vercelHandler(req,res);
}
