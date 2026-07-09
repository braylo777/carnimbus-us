-- M5: the testimonial poster's handle was "Cid Condoluci", the same name as the dealer "Cid" thanked in the post body
-- (feed rendered "Cid Condoluci · Huge thanks to Cid…"). Rename the poster to a neutral neighbor. Remote-safe (UPDATE, no DELETE).
UPDATE users SET handle='Marisol R.' WHERE phone='+13104647885';
