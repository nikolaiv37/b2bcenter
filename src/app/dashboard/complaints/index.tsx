// This page saves hours of WhatsApp chaos every week
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { MyComplaintsTab } from './MyComplaintsTab'
import { NewComplaintTab } from './NewComplaintTab'
import { AdminComplaintsView } from './AdminComplaintsView'

export function ComplaintsPage() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('my-complaints')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleComplaintSubmitted = () => {
    setActiveTab('my-complaints')
    setRefreshKey((prev) => prev + 1)
  }

  // Admin sees completely different view
  if (isAdmin) {
    return <AdminComplaintsView />
  }

  // Company users see the original tabs view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t('complaints.title')}</h1>
        <p className="text-muted-foreground">
          {t('complaints.subtitle')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-12 min-w-max items-center justify-start gap-2 rounded-2xl border border-gray-200/30 bg-gradient-to-br from-white via-gray-50/80 to-white p-1.5 shadow-sm backdrop-blur-md transition-shadow duration-200 hover:shadow-md dark:border-gray-700/20 dark:from-gray-800 dark:via-gray-900/80 dark:to-gray-800">
            <TabsTrigger
              value="my-complaints"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ease-out sm:px-6 data-[state=active]:bg-gradient-to-br data-[state=active]:from-gray-100/90 data-[state=active]:via-white/95 data-[state=active]:to-gray-50/90 dark:data-[state=active]:from-gray-700/90 dark:data-[state=active]:via-gray-600/95 dark:data-[state=active]:to-gray-700/90 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-gray-300/50 dark:data-[state=active]:border-gray-500/40 data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-700 dark:data-[state=inactive]:hover:text-slate-200 data-[state=inactive]:hover:bg-slate-100/50 dark:data-[state=inactive]:hover:bg-slate-800/30"
            >
              {t('complaints.myComplaints')}
            </TabsTrigger>
            <TabsTrigger
              value="new-complaint"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ease-out sm:px-6 data-[state=active]:bg-gradient-to-br data-[state=active]:from-gray-100/90 data-[state=active]:via-white/95 data-[state=active]:to-gray-50/90 dark:data-[state=active]:from-gray-700/90 dark:data-[state=active]:via-gray-600/95 dark:data-[state=active]:to-gray-700/90 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-gray-300/50 dark:data-[state=active]:border-gray-500/40 data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-700 dark:data-[state=inactive]:hover:text-slate-200 data-[state=inactive]:hover:bg-slate-100/50 dark:data-[state=inactive]:hover:bg-slate-800/30"
            >
              {t('complaints.newComplaint')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-complaints">
          <MyComplaintsTab key={refreshKey} />
        </TabsContent>

        <TabsContent value="new-complaint">
          <NewComplaintTab onSubmitted={handleComplaintSubmitted} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
