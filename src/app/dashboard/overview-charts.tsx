import { useTranslation } from 'react-i18next'
import { TrendingUp } from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface OverviewChartsStats {
  revenueByDay: Array<{ date: string; revenue: number }>
  ordersByDay: Array<{ date: string; orders: number }>
  categoriesByRevenue: Array<{ name: string; value: number; revenue: number }>
}

const COLORS = [
  'hsl(var(--primary))',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
]

export function OverviewChartsSection({
  stats,
  isLoading,
}: {
  stats: OverviewChartsStats | null | undefined
  isLoading: boolean
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="text-xl font-semibold mb-4">{t('overview.revenueThisMonth')}</h2>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : stats?.revenueByDay && stats.revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.revenueByDay}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `€${value.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    backdropFilter: 'blur(10px)',
                  }}
                  formatter={(value: number) => formatCurrency(value, 'EUR')}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('overview.noRevenueDataThisMonth')}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-semibold mb-4">{t('overview.ordersLast30Days')}</h2>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : stats?.ordersByDay && stats.ordersByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.ordersByDay}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    backdropFilter: 'blur(10px)',
                  }}
                />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('overview.noOrdersLast30Days')}
            </div>
          )}
        </GlassCard>
      </div>

      {stats?.categoriesByRevenue && stats.categoriesByRevenue.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">{t('overview.topCategoriesByRevenue')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('overview.revenueDistributionDescription')}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-br from-white/90 via-gray-50/80 to-white/70 dark:from-gray-800/90 dark:via-gray-700/80 dark:to-gray-800/70 border border-gray-200/60 dark:border-gray-600/40 backdrop-blur-md shadow-md hover:shadow-lg hover:border-gray-300/80 dark:hover:border-gray-500/60 transition-all duration-200">
              <div className="relative">
                <div className="p-2 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 border border-gray-200/50 dark:border-gray-600/50 shadow-sm">
                  <TrendingUp className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gray-400 dark:bg-gray-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider leading-none mb-0.5">
                  {t('overview.categoriesCount', { count: stats.categoriesByRevenue.length })}
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(
                    stats.categoriesByRevenue.reduce((sum, cat) => sum + cat.revenue, 0),
                    'EUR'
                  )} {t('overview.totalRevenueLabel')}
                </span>
              </div>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-96 w-full rounded-lg" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="relative bg-gradient-to-br from-muted/20 to-muted/5 rounded-2xl p-8 border border-border/40">
                  <ResponsiveContainer width="100%" height={340}>
                    <PieChart>
                      <defs>
                        {stats.categoriesByRevenue.map((_entry, index) => (
                          <linearGradient
                            key={`gradient-${index}`}
                            id={`gradient-${index}`}
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.95} />
                            <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.75} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={stats.categoriesByRevenue}
                        cx="50%"
                        cy="50%"
                        innerRadius={85}
                        outerRadius={125}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={4}
                      >
                        {stats.categoriesByRevenue.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`url(#gradient-${index})`}
                            stroke="hsl(var(--background))"
                            strokeWidth={3}
                            style={{
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '10px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                          padding: '12px',
                          zIndex: 1000,
                        }}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as { name: string; value: number; revenue: number }
                            const total = stats.categoriesByRevenue.reduce((sum, cat) => sum + cat.value, 0)
                            const percent = ((data.value / total) * 100).toFixed(1)
                            const colorIndex = stats.categoriesByRevenue.findIndex(c => c.name === data.name)
                            const color = COLORS[colorIndex % COLORS.length]

                            return (
                              <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[180px] z-50">
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <p className="font-semibold text-sm text-foreground truncate">{data.name}</p>
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-lg font-bold text-primary">
                                    {formatCurrency(data.revenue, 'EUR')}
                                  </p>
                                  <div className="flex items-center gap-2 pt-1.5 border-t border-border/50">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: `${percent}%`,
                                          backgroundColor: color,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold text-muted-foreground min-w-[40px] text-right">
                                      {percent}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-muted-foreground/60 mb-1.5 uppercase tracking-wider">
                        {t('overview.totalRevenue')}
                      </p>
                      <p className="text-2xl md:text-3xl font-bold text-foreground mb-1 leading-tight">
                        {formatCurrency(
                          stats.categoriesByRevenue.reduce((sum, cat) => sum + cat.revenue, 0),
                          'EUR'
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50">
                        {t('overview.categoriesCount', { count: stats.categoriesByRevenue.length })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-5">
                    {t('overview.categoryBreakdown')}
                  </h3>
                  <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
                    {stats.categoriesByRevenue.map((cat, index) => {
                      const totalRevenue = stats.categoriesByRevenue.reduce((sum, c) => sum + c.revenue, 0)
                      const percentage = (cat.revenue / totalRevenue) * 100
                      const color = COLORS[index % COLORS.length]

                      return (
                        <div
                          key={cat.name}
                          className="group relative p-4 rounded-2xl border border-border/30 bg-background/40 hover:bg-background/60 hover:border-border/50 transition-all duration-200"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                              style={{ backgroundColor: color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground leading-snug mb-1.5">
                                {cat.name}
                              </p>
                              <p className="text-xs text-muted-foreground/80">
                                {percentage.toFixed(1)}% {t('overview.ofTotal')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-base font-semibold text-foreground">
                              {formatCurrency(cat.revenue, 'EUR')}
                            </p>
                            <span className="text-xs font-medium text-muted-foreground/70">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-3 h-1 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 ease-out"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: color,
                                opacity: 0.7,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </>
  )
}

