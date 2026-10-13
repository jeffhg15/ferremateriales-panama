// Abre WhatsApp con un mensaje codificado. Abrir WhatsApp NO crea pedidos, NO reserva existencias
// ni confirma pagos o entregas.
export function waLink(settings, message, index = 0) {
  const raw = (settings?.whatsappNumbers || [])[index] || '';
  const digits = String(raw).replace(/\D/g, '');
  const cc = String(settings?.whatsappCountryCode || '507').replace(/\D/g, '');
  const full = digits.startsWith(cc) && digits.length > 8 ? digits : `${cc}${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}
