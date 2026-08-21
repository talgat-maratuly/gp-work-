import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface Props {
  value: string
  className?: string
  size?: number
}

export function QrCanvas({ value, className = '', size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [value, size])

  return <canvas ref={canvasRef} className={className} />
}
