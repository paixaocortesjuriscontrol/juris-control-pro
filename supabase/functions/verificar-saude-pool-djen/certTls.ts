// Leitura da validade do certificado TLS sem depender de node:tls
// (getPeerCertificate() volta vazio no runtime do Supabase). Fazemos um
// ClientHello TLS 1.2 e lemos notAfter do primeiro certificado DER.
// TLS 1.2 ClientHello mínimo + parse do Certificate para achar notAfter.
function u16(n: number) { return [(n >> 8) & 0xff, n & 0xff]; }

function clientHello(host: string): Uint8Array {
  const rnd = crypto.getRandomValues(new Uint8Array(32));
  const sni: number[] = [];
  const hostBytes = new TextEncoder().encode(host);
  const nameEntry = [0x00, ...u16(hostBytes.length), ...hostBytes];
  const serverNameList = [...u16(nameEntry.length), ...nameEntry];
  sni.push(0x00, 0x00, ...u16(serverNameList.length), ...serverNameList);

  const sigAlgs = [0x04,0x01, 0x05,0x01, 0x06,0x01, 0x04,0x03, 0x05,0x03, 0x06,0x03, 0x08,0x04, 0x08,0x05, 0x08,0x06, 0x02,0x01];
  const sigExt = [0x00,0x0d, ...u16(sigAlgs.length + 2), ...u16(sigAlgs.length), ...sigAlgs];
  const groups = [0x00,0x1d, 0x00,0x17, 0x00,0x18];
  const groupsExt = [0x00,0x0a, ...u16(groups.length + 2), ...u16(groups.length), ...groups];
  const pointFmtExt = [0x00,0x0b, 0x00,0x02, 0x01, 0x00];

  const exts = [...sni, ...sigExt, ...groupsExt, ...pointFmtExt];
  const ciphers = [0xc0,0x2f, 0xc0,0x30, 0xc0,0x2b, 0xc0,0x2c, 0x00,0x9c, 0x00,0x9d, 0xc0,0x13, 0xc0,0x14];
  const body = [
    0x03, 0x03,
    ...rnd,
    0x00,
    ...u16(ciphers.length), ...ciphers,
    0x01, 0x00,
    ...u16(exts.length), ...exts,
  ];
  const hs = [0x01, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff, ...body];
  return new Uint8Array([0x16, 0x03, 0x01, ...u16(hs.length), ...hs]);
}

function asn1Len(buf: Uint8Array, i: number): { len: number; next: number } {
  let b = buf[i++];
  if (b < 0x80) return { len: b, next: i };
  const n = b & 0x7f;
  let len = 0;
  for (let k = 0; k < n; k++) len = (len << 8) | buf[i++];
  return { len, next: i };
}

/** Retorna notBefore/notAfter do primeiro certificado DER. */
function parseValidity(der: Uint8Array): { notAfter: Date | null } {
  // Certificate ::= SEQUENCE { tbsCertificate SEQUENCE { ... validity SEQUENCE { UTCTime, UTCTime } } }
  let i = 0;
  if (der[i++] !== 0x30) return { notAfter: null };
  ({ next: i } = asn1Len(der, i));
  if (der[i++] !== 0x30) return { notAfter: null }; // tbsCertificate
  let tbs = asn1Len(der, i);
  i = tbs.next;
  const end = i + tbs.len;
  // percorre campos do tbs até achar SEQUENCE de 2 tempos (validity)
  while (i < end) {
    const tag = der[i];
    const l = asn1Len(der, i + 1);
    const contentStart = l.next;
    if (tag === 0x30) {
      const t1 = der[contentStart];
      if (t1 === 0x17 || t1 === 0x18) {
        const l1 = asn1Len(der, contentStart + 1);
        const after = l1.next + l1.len;
        const t2 = der[after];
        if (t2 === 0x17 || t2 === 0x18) {
          const l2 = asn1Len(der, after + 1);
          const raw = new TextDecoder().decode(der.subarray(l2.next, l2.next + l2.len));
          return { notAfter: parseAsn1Time(raw, t2 === 0x18) };
        }
      }
    }
    i = contentStart + l.len;
  }
  return { notAfter: null };
}

function parseAsn1Time(raw: string, generalized: boolean): Date | null {
  const m = generalized
    ? raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/)
    : raw.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/);
  if (!m) return null;
  let year = Number(m[1]);
  if (!generalized) year = year >= 50 ? 1900 + year : 2000 + year;
  return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || "0")));
}

export async function lerNotAfter(host: string, port: number, timeoutMs = 12000) {
  const conn = await Deno.connect({ hostname: host, port });
  const t = setTimeout(() => { try { conn.close(); } catch {} }, timeoutMs);
  try {
    await conn.write(clientHello(host));
    const chunks: number[] = [];
    const buf = new Uint8Array(16384);
    let notAfter: Date | null = null;
    for (let reads = 0; reads < 40; reads++) {
      const n = await conn.read(buf);
      if (n === null) break;
      for (let k = 0; k < n; k++) chunks.push(buf[k]);
      const data = new Uint8Array(chunks);
      // varre records TLS handshake procurando msg type 11 (Certificate)
      let i = 0;
      while (i + 5 <= data.length) {
        const type = data[i];
        const recLen = (data[i + 3] << 8) | data[i + 4];
        if (i + 5 + recLen > data.length) break;
        if (type === 0x16) {
          let j = i + 5;
          while (j + 4 <= i + 5 + recLen) {
            const hsType = data[j];
            const hsLen = (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3];
            if (hsType === 11 && j + 4 + hsLen <= data.length) {
              let p = j + 4 + 3; // pula certificate_list length
              const certLen = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
              p += 3;
              const der = data.subarray(p, p + certLen);
              notAfter = parseValidity(der).notAfter;
              return notAfter;
            }
            j += 4 + hsLen;
          }
        }
        i += 5 + recLen;
      }
    }
    return notAfter;
  } finally {
    clearTimeout(t);
    try { conn.close(); } catch {}
  }
}
