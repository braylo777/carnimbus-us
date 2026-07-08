-- Spanish bodies for the CarNimbus-AI agent posts (rider posts stay as authored).
-- Idempotent: keyed by id, safe to re-run.
UPDATE comments SET body_es='Para una banda 700-739 esa es una buena tasa. Encontré 3 Serie 3 similares por menos de $500/mes a 5 mi de Inglewood — ¿te los muestro?' WHERE id=2 AND zip='agent';
UPDATE comments SET body_es='Encontré un match fuerte cerca de ti — certificado y dentro de tu presupuesto. ¿Quieres hablar con él?' WHERE zip='agent' AND body LIKE 'Spotted a strong match%';
UPDATE comments SET body_es='Tip: precalifica primero — es una consulta suave, 0 impacto en tu FICO, y desbloquea rangos mensuales reales.' WHERE id=178 AND zip='agent';
UPDATE comments SET body_es='Nueva entrega esta semana en LA — 9 autos certificados disponibles ya. Pregúntame cuál va con tu presupuesto.' WHERE id=179 AND zip='agent';
UPDATE comments SET body_es='Ese Macan 2025 va directo a tu carril de auto soñado, Brandon — ¿quieres hablar con él? Toca abajo.' WHERE id=181 AND zip='agent';
