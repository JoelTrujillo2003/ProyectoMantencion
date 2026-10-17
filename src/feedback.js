import { ApiError } from './supabase.js';

const CATEGORIES = new Set(['suggestion', 'bug', 'vehicle_request', 'other']);

export function validateFeedback(body = {}) {
  if (!body || !CATEGORIES.has(body.type)) {
    throw new ApiError(400, 'Selecciona un tipo de solicitud válido.', 'invalid_feedback');
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (subject.length < 3 || subject.length > 120) {
    throw new ApiError(400, 'El asunto debe tener entre 3 y 120 caracteres.', 'invalid_feedback');
  }
  if (message.length < 10 || message.length > 2000) {
    throw new ApiError(400, 'El mensaje debe tener entre 10 y 2000 caracteres.', 'invalid_feedback');
  }
  if (body.consent !== true) {
    throw new ApiError(400, 'Acepta el uso de los datos para gestionar la solicitud.', 'feedback_consent_required');
  }
  // Nunca recibimos la identidad, el correo o el estado desde el navegador.
  return { p_type: body.type, p_subject: subject, p_message: message, p_consent: true };
}

export function mapFeedbackError(error) {
  if (error.message?.includes('FEEDBACK_RATE_LIMIT')) {
    return new ApiError(429, 'Ya enviaste 5 mensajes en los últimos 10 minutos. Espera unos minutos antes de volver a enviar.', 'feedback_rate_limit');
  }
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code)) {
    return new ApiError(503, 'El formulario aún no está habilitado. El administrador debe ejecutar la migración 002_feedback.sql.', 'feedback_not_configured');
  }
  return error;
}
