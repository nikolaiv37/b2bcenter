import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const signupSchema = z.object({
  email: z.string().email('errors.invalidEmail'),
  password: z.string().min(6, 'auth.passwordMinLength'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'auth.passwordsMustMatch',
  path: ['confirmPassword'],
})

type SignupFormData = z.infer<typeof signupSchema>

export function SignupPage() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      })

      if (error) throw error

      toast({
        title: t('auth.accountCreated'),
        description: t('auth.accountCreatedDescription'),
      })
      
      const nextPath = '/auth/login'

      setTimeout(() => {
        navigate(nextPath)
      }, 500)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('auth.signupFailedDescription')
      toast({
        title: t('auth.signupFailed'),
        description: errorMessage || t('auth.signupFailedDescription'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <GlassCard>
          <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Package className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('auth.joinFurniTrade')}</h1>
          <p className="text-muted-foreground">
            {t('auth.createAccountSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message ? t(errors.email.message) : ''}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message ? t(errors.password.message) : ''}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message
                  ? t(errors.confirmPassword.message)
                  : ''}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('auth.createAccount')}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-muted-foreground">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link
              to="/auth/login"
              className="text-primary font-semibold hover:underline"
            >
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </GlassCard>
      </div>
    </div>
  )
}
