import { useState, useEffect } from 'react'

export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return {
    width,
    isMobile: width < 640,   // < 640px  — phones
    isTablet: width < 1024,  // < 1024px — tablets / small laptops
    isDesktop: width >= 1024,
  }
}
