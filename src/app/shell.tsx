import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  MessageSquare, 
  Settings, 
  List, 
  Clock, 
  Wrench, 
  BarChart3,
  Menu,
  X
} from 'lucide-react'

interface ShellProps {
  children: React.ReactNode
}

const navItems = [
  { icon: MessageSquare, label: 'Chat', id: 'chat' },
  { icon: List, label: 'Sessions', id: 'sessions' },
  { icon: Clock, label: 'Cron', id: 'cron' },
  { icon: Wrench, label: 'Skills', id: 'skills' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics' },
  { icon: Settings, label: 'Settings', id: 'settings' },
]

export function Shell({ children }: ShellProps) {
  const [activeNav, setActiveNav] = useState('chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-[var(--surface)] text-[var(--foreground)]">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex w-60 flex-col border-r border-[var(--separator)] bg-[var(--surface)] transition-all',
          sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--separator)] px-4">
          <h1 className="text-lg font-semibold">Hermes</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeNav === item.id ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveNav(item.id)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="flex h-14 items-center border-b border-[var(--separator)] bg-[var(--surface)] px-4">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="mr-2"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-lg font-medium capitalize">{activeNav}</h2>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
