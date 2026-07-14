import React, { useState } from 'react'
import { UIContext } from './uiContext';

export function UIProvider({children}) {

    const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <UIContext.Provider value={{isChatOpen, setIsChatOpen}}>
        {children}
    </UIContext.Provider>
  )
}

