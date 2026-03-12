import { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/use-toast'
import { CompanyForm, CompanyFormData } from '@/components/CompanyForm'
import { supabase } from '@/lib/supabase/client'
import { cn, slugify } from '@/lib/utils'
import { Building2, User, Lock, Users, UserPlus, Mail, Loader2, Shield, Crown, Clock, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryTeamMembers, useQueryTeamInvitations } from '@/hooks/useQueryTeamMembers'
import {
  useMutationInviteTeamMember,
  useMutationRevokeTeamInvite,
} from '@/hooks/useMutationInviteTeamMember'
import { EcontIntegrationSettings } from '@/components/integrations/EcontIntegrationSettings'

type SettingsSection = 'company' | 'team' | 'profile' | 'integrations'

export function SettingsPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { company, profile, user, isAdmin } = useAuth()
  const { workspaceId: tenantId } = useAppContext()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [activeSection, setActiveSection] = useState<SettingsSection>('company')

  // Sync active section with location hash (#company / #team / #profile)
  useEffect(() => {
    if (location.hash === '#profile') {
      setActiveSection('profile')
    } else if (location.hash === '#integrations' && isAdmin) {
      setActiveSection('integrations')
    } else if (location.hash === '#team' && isAdmin) {
      setActiveSection('team')
    } else {
      setActiveSection('company')
    }
  }, [location.hash, isAdmin])

  const handleCompanySubmit = async (data: CompanyFormData, logoUrl: string | null) => {
    if (!user || !company || !tenantId) {
      toast({
        title: t('settings.error'),
        description: t('settings.mustBeLoggedIn'),
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const slug = slugify(data.companyName)

      const { data: updatedCompany, error } = await supabase
        .from('companies')
        .update({
          name: data.companyName,
          slug,
          logo_url: logoUrl,
          eik_bulstat: data.eikBulstat,
          vat_number: data.vatNumber,
          phone: data.phone,
          city: data.city,
          address: data.address,
          website: data.website || null,
          // Invoice-related fields
          mol: data.mol,
          bank_name: data.bankName,
          iban: data.iban,
          bic: data.bic,
        })
        .eq('id', company.id)
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) throw error

      // Update company in store
      useAuthStore.getState().setCompany(updatedCompany)

      toast({
        title: t('settings.success'),
        description: t('settings.companyUpdated'),
      })
    } catch (error: unknown) {
      console.error('Error updating company:', error)
      toast({
        title: t('settings.updateFailed'),
        description:
          error instanceof Error ? error.message : t('settings.failedToUpdate'),
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // ----- Profile Settings (password only + email display) -----

  const passwordSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(6, t('auth.passwordMinLength')),
          newPassword: z.string().min(6, t('auth.passwordMinLength')),
          confirmNewPassword: z.string().min(6, t('auth.passwordMinLength')),
        })
        .refine((values) => values.newPassword === values.confirmNewPassword, {
          path: ['confirmNewPassword'],
          message: t('settings.passwordsMustMatch'),
        }),
    [t]
  )

  type PasswordFormData = z.infer<typeof passwordSchema>

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: {
      errors: passwordErrors,
      isDirty: isPasswordDirty,
      isValid: isPasswordValid,
      isSubmitting: isPasswordSubmitting,
    },
    reset: resetPasswordForm,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    mode: 'onChange',
  })

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (!user) {
      toast({
        title: t('settings.error'),
        description: t('settings.mustBeLoggedIn'),
        variant: 'destructive',
      })
      return
    }

    setIsUpdatingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      })

      if (error) throw error

      toast({
        title: t('settings.success'),
        description: t('settings.passwordUpdated'),
      })

      resetPasswordForm()
    } catch (error: unknown) {
      console.error('Error updating password:', error)
      toast({
        title: t('settings.updateFailed'),
        description:
          error instanceof Error ? error.message : t('settings.passwordUpdateFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
        {/* Local Settings sidebar (within the Settings page) */}
        <GlassCard className="p-4 h-fit sticky top-20 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('nav.settings')}
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveSection('company')
                if (location.hash !== '#company') {
                  window.history.replaceState({}, '', `${location.pathname}#company`)
                }
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                activeSection === 'company'
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <Building2 className="w-4 h-4" />
              <span>{t('nav.company')}</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setActiveSection('integrations')
                  if (location.hash !== '#integrations') {
                    window.history.replaceState({}, '', `${location.pathname}#integrations`)
                  }
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  activeSection === 'integrations'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-muted-foreground'
                )}
              >
                <Shield className="w-4 h-4" />
                <span>Integrations</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setActiveSection('team')
                  if (location.hash !== '#team') {
                    window.history.replaceState({}, '', `${location.pathname}#team`)
                  }
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  activeSection === 'team'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-muted-foreground'
                )}
              >
                <Users className="w-4 h-4" />
                <span>{t('nav.team')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveSection('profile')
                if (location.hash !== '#profile') {
                  window.history.replaceState({}, '', `${location.pathname}#profile`)
                }
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                activeSection === 'profile'
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <User className="w-4 h-4" />
              <span>{t('nav.profile')}</span>
            </button>
          </div>
        </GlassCard>

        {/* Content */}
        <div className="space-y-6 pb-10">
          {activeSection === 'company' && (
            <GlassCard className="p-6">
              <h2 className="text-xl font-semibold mb-6">
                {t('settings.companyInformation')}
              </h2>
              <CompanyForm
                company={company}
                onSubmit={handleCompanySubmit}
                isLoading={isSaving}
                showLogoUpload={true}
                mode="edit"
              />
            </GlassCard>
          )}

          {activeSection === 'team' && isAdmin && (
            <TeamSection />
          )}

          {activeSection === 'integrations' && isAdmin && (
            <EcontIntegrationSettings />
          )}

          {activeSection === 'profile' && (
            <>
              {/* Email display */}
              <GlassCard className="p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">
                    {t('settings.profileSettings')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.profileDescription')}
                  </p>
                </div>

                <div className="space-y-1.5 max-w-md">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || user?.email || ''}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settings.emailCannotBeChanged')}
                  </p>
                </div>
              </GlassCard>

              {/* Change Password */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <h2 className="text-xl font-semibold">
                    {t('settings.changePassword')}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('settings.changePasswordDescription')}
                </p>

                <form
                  id="password-settings-form"
                  onSubmit={handleSubmitPassword(onPasswordSubmit)}
                  className="space-y-4"
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="currentPassword">
                        {t('settings.currentPassword')}
                      </Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        {...registerPassword('currentPassword')}
                      />
                      {passwordErrors.currentPassword && (
                        <p className="text-sm text-destructive">
                          {passwordErrors.currentPassword.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword">
                        {t('settings.newPassword')}
                      </Label>
                      <Input
                        id="newPassword"
                        type="password"
                        autoComplete="new-password"
                        {...registerPassword('newPassword')}
                      />
                      {passwordErrors.newPassword && (
                        <p className="text-sm text-destructive">
                          {passwordErrors.newPassword.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmNewPassword">
                        {t('settings.confirmNewPassword')}
                      </Label>
                      <Input
                        id="confirmNewPassword"
                        type="password"
                        autoComplete="new-password"
                        {...registerPassword('confirmNewPassword')}
                      />
                      {passwordErrors.confirmNewPassword && (
                        <p className="text-sm text-destructive">
                          {passwordErrors.confirmNewPassword.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      {t('settings.passwordNote')}
                    </p>
                    <Button
                      type="submit"
                      form="password-settings-form"
                      size="sm"
                      disabled={
                        isUpdatingPassword ||
                        !isPasswordDirty ||
                        !isPasswordValid ||
                        isPasswordSubmitting
                      }
                    >
                      {isUpdatingPassword && (
                        <span className="mr-2 h-3 w-3 animate-spin border-2 border-current border-t-transparent rounded-full" />
                      )}
                      {t('settings.updatePasswordButton')}
                    </Button>
                  </div>
                </form>
              </GlassCard>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamSection() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()
  const { data: teamMembers, isLoading: membersLoading } = useQueryTeamMembers()
  const { data: pendingInvites, isLoading: invitesLoading } = useQueryTeamInvitations()
  const inviteMutation = useMutationInviteTeamMember()
  const revokeMutation = useMutationRevokeTeamInvite()

  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      toast({ title: t('settings.error'), description: t('settings.teamEmailRequired'), variant: 'destructive' })
      return
    }

    try {
      const result = await inviteMutation.mutateAsync({ email })

      if (result?.email_sent === false) {
        toast({
          title: t('settings.success'),
          description: t('settings.teamInviteSentNoEmail', { email }),
          variant: 'destructive',
        })
      } else {
        toast({ title: t('settings.success'), description: t('settings.teamInviteSent', { email }) })
      }

      setIsInviteOpen(false)
      setInviteEmail('')
    } catch (err) {
      toast({
        title: t('settings.error'),
        description: err instanceof Error ? err.message : t('settings.teamInviteError'),
        variant: 'destructive',
      })
    }
  }

  const handleRevoke = async (invite: { id: string; email: string }) => {
    if (!window.confirm(t('settings.revokeInviteConfirm', { email: invite.email }))) return
    try {
      await revokeMutation.mutateAsync(invite.id)
      toast({ title: t('settings.success'), description: t('settings.inviteRevoked', { email: invite.email }) })
    } catch (err) {
      toast({
        title: t('settings.error'),
        description: err instanceof Error ? err.message : t('settings.revokeInviteError'),
        variant: 'destructive',
      })
    }
  }

  const roleBadge = (role: string) => {
    if (role === 'owner') {
      return (
        <Badge variant="default" className="gap-1 bg-amber-600 hover:bg-amber-700">
          <Crown className="w-3 h-3" />
          {t('settings.owner')}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Shield className="w-3 h-3" />
        {t('settings.admin')}
      </Badge>
    )
  }

  return (
    <>
      <GlassCard className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">{t('settings.teamTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.teamDescription')}</p>
          </div>
          <Button onClick={() => setIsInviteOpen(true)} size="sm" className="gap-2">
            <UserPlus className="w-4 h-4" />
            {t('settings.inviteTeammate')}
          </Button>
        </div>

        {membersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !teamMembers?.length ? (
          <p className="text-sm text-muted-foreground py-4">{t('settings.noTeamMembers')}</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {teamMembers.map((member) => {
              const isCurrentUser = member.user_id === user?.id
              const displayName = member.full_name || member.email || (isCurrentUser ? user?.user_metadata?.full_name ?? user?.email ?? null : null) || null
              const displayEmail = member.email || (isCurrentUser ? user?.email ?? null : null) || null
              const label = displayName || displayEmail || t('settings.unknown')
              return (
              <div key={member.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {label
                      .split(' ')
                      .map((w: string) => w[0])
                      .slice(0, 2)
                      .filter(Boolean)
                      .join('')
                      .toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {label}
                      </p>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {t('settings.you')}
                        </Badge>
                      )}
                    </div>
                    {displayEmail && (
                      <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {roleBadge(member.role)}
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {t('settings.joined')} {format(new Date(member.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* Pending team invitations */}
      {!invitesLoading && pendingInvites && pendingInvites.length > 0 && (
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t('settings.pendingTeamInvites')}</h3>
          </div>
          <div className="divide-y divide-border rounded-lg border">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.invitedOn')} {format(new Date(invite.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRevoke(invite)}
                    disabled={revokeMutation.isPending}
                    title={t('settings.revokeInvite')}
                  >
                    {revokeMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Invite teammate modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {t('settings.inviteTeammate')}
            </DialogTitle>
            <DialogDescription>{t('settings.inviteTeammateDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="team-email">{t('auth.email')}</Label>
              <Input
                id="team-email"
                type="email"
                placeholder={t('settings.teamEmailPlaceholder')}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleInvite()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              {t('general.cancel')}
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending} className="gap-2">
              {inviteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('settings.inviteTeammate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
