import React, { createContext, useContext, useState } from 'react'

const UIContext = createContext();

export function UIProvider({children}) {

    const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <UIContext.Provider value={{isChatOpen, setIsChatOpen}}>
        {children}
    </UIContext.Provider>
  )
}

export function useUI(){
    return useContext(UIContext);
}
