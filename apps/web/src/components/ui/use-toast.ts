"use client"

// Simplified toast hook using sonner
import { toast as sonnerToast } from 'sonner'

export function useToast() {
  return {
    toast: ({
      title,
      description,
      variant = "default",
      ...props
    }: {
      title?: string
      description?: string
      variant?: "default" | "destructive"
    }) => {
      if (variant === "destructive") {
        return sonnerToast.error(title, {
          description,
          ...props,
        })
      }
      
      return sonnerToast.success(title, {
        description,
        ...props,
      })
    },
    dismiss: sonnerToast.dismiss,
  }
}

export const toast = {
  success: (message: string, options?: Record<string, unknown>) => sonnerToast.success(message, options),
  error: (message: string, options?: Record<string, unknown>) => sonnerToast.error(message, options),
  info: (message: string, options?: Record<string, unknown>) => sonnerToast.info(message, options),
  warning: (message: string, options?: Record<string, unknown>) => sonnerToast.warning(message, options),
}
