/**
 * Contraseñas legadas en ELABASTECEDOR (columna Clave NVARCHAR): no son hash ni PWDCOMPARE.
 * Patrón observado en producción: por bloques contiguos de letras [A-Za], la primera letra usa
 * código + 15 y las siguientes -17; cada dígito [0-9] usa código +15. Otros caracteres se copian.
 *
 * Ej.: "Sinergia2025" → "bX]TaVXPA?AD"
 */
import crypto from 'crypto';

/**
 * @param {string} plain
 * @returns {string}
 */
export function encodeElabLegacyClave(plain) {
  const s = String(plain ?? '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') {
      out += String.fromCharCode(ch.charCodeAt(0) + 15);
      i += 1;
      continue;
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      out += String.fromCharCode(ch.charCodeAt(0) + 15);
      i += 1;
      while (i < s.length) {
        const c2 = s[i];
        if ((c2 >= 'a' && c2 <= 'z') || (c2 >= 'A' && c2 <= 'Z')) {
          out += String.fromCharCode(c2.charCodeAt(0) - 17);
          i += 1;
        } else {
          break;
        }
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function timingSafeEqualUtf8(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * @param {string} plain
 * @param {unknown} storedNvarchar — valor ya como string (columna Clave leída en NVARCHAR)
 * @returns {boolean}
 */
export function verifyElabLegacyClave(plain, storedNvarchar) {
  const enc = encodeElabLegacyClave(plain);
  const t = String(storedNvarchar ?? '').trim();
  if (!t) return false;
  if (timingSafeEqualUtf8(enc, t)) return true;
  if (enc.length === t.length && timingSafeEqualUtf8(enc.toLowerCase(), t.toLowerCase())) return true;
  return false;
}
