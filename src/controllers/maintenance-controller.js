import { Router } from 'express';
import { authenticateRequest } from '../supabase.js';
import * as service from '../services/maintenance-service.js';

const router = Router();
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const context = async req => {
  const { token, user } = await authenticateRequest(req);
  return { token, userId: user.id };
};

router.get('/', handle(async (req, res) => {
  const { token, userId } = await context(req);
  res.json({ records: await service.list(token, userId, req.query.vehicle_id) });
}));

router.get('/:id', handle(async (req, res) => {
  const { token, userId } = await context(req);
  res.json({ record: await service.get(token, userId, req.params.id) });
}));

router.post('/', handle(async (req, res) => {
  const { token, userId } = await context(req);
  const record = await service.create(token, userId, req.body);
  res.location(`/api/maintenance-records/${record.id}`).status(201).json({ record });
}));

router.put('/:id', handle(async (req, res) => {
  const { token, userId } = await context(req);
  res.json({ record: await service.replace(token, userId, req.params.id, req.body) });
}));

router.delete('/:id', handle(async (req, res) => {
  const { token, userId } = await context(req);
  await service.remove(token, userId, req.params.id);
  res.sendStatus(204);
}));

export default router;
