import { useTheme } from '@emotion/react'
import React from 'react'

export default function MirageLogo({height = 36}) {

  const theme = useTheme();

  return (
    <svg 
      width="120" 
      height={height} 
      viewBox="0 0 120 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle 
        cx="16" 
        cy="20" 
        r="13" 
        stroke="#7F77DD" 
        strokeWidth="2" 
        fill="none"
      />

      <circle 
        cx="28"
        cy="20" 
        r="13" 
        stroke="#AFA9EC" 
        strokeWidth="2" 
        fill="none" 
        opacity="0.7"
      />
      <text 
        x="48" 
        y="26" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontSize="18" 
        fontWeight="500" 
        letterSpacing="-0.4" 
        fill={theme.palette.text.primary}
      >
        mirage
      </text>
    </svg>

    
  )
}

