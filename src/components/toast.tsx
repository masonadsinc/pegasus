'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Toast { id: number; message: string; type?: 'success' | 'error' | 'info' }

const ToastContext = createContext<{ toast: (message: string, type?: Toast['type']) => void }>({ toast: () => {} })

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let counter = 0

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++counter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`toast-in px-4 py-2.5 rounded-md shadow-lg text-[13px] font-medium flex items-center gap-2 ${
            t.type === 'error' ? 'bg-[#dc2626] text-white' :
            t.type === 'info' ? 'bg-[#111113] text-white' :
            'bg-[#111113] text-white'
          }`}>
            {t.type === 'success' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8.5l3 3 7-7" /></svg>}
            {t.type === 'error' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
