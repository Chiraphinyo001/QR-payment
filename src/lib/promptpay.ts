// =============================================
// PromptPay QR Code Generator (EMV Co standard)
// =============================================

export type ProxyType = 'phone' | 'national_id' | 'bank_account'

export interface GenerateQrOptions {
  proxyType: ProxyType
  proxyValue: string   // เบอร์โทร 10 หลัก / เลข ปชช 13 หลัก / รหัสธนาคาร+เลขบัญชี
  amount?: number      // จำนวนเงิน (optional)
}

function tlv(tag: string, value: string): string {
  return tag + value.length.toString().padStart(2, '0') + value
}

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function normalizePhone(phone: string): string {
  // แปลง 0812345678 → 0066812345678 (ตัด leading 0, ใส่ country code)
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('66')) return digits
  if (digits.startsWith('0')) return '0066' + digits.slice(1)
  return '0066' + digits
}

export function buildPromptPayPayload(opts: GenerateQrOptions): string {
  const { proxyType, proxyValue, amount } = opts

  let proxyTag = ''
  if (proxyType === 'phone') {
    proxyTag = tlv('01', normalizePhone(proxyValue))
  } else if (proxyType === 'national_id') {
    proxyTag = tlv('02', proxyValue.replace(/\D/g, ''))
  } else {
    // bank_account: proxyValue = bankCode (3 หลัก) + accountNumber
    proxyTag = tlv('03', proxyValue)
  }

  let payload = '000201'
  payload += tlv('29', tlv('00', 'A000000677010111') + tlv('01', proxyTag))
  payload += '5303764' // THB
  if (amount !== undefined && amount > 0) {
    payload += tlv('54', amount.toFixed(2))
  }
  payload += '5802TH'
  payload += '6304'
  payload += crc16(payload + '6304')

  return payload
}

export function validateProxy(type: ProxyType, value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (type === 'phone') {
    if (digits.length !== 10) return 'เบอร์โทรต้องมี 10 หลัก'
    if (!digits.startsWith('0')) return 'เบอร์โทรต้องขึ้นต้นด้วย 0'
  }
  if (type === 'national_id') {
    if (digits.length !== 13) return 'เลขบัตรประชาชนต้องมี 13 หลัก'
  }
  if (type === 'bank_account') {
    if (digits.length < 10) return 'กรุณากรอกเลขบัญชีให้ครบ'
  }
  return null
}
