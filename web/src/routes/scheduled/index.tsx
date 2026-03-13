import { useAppContext } from '@/lib/app-context'
import { useMachines } from '@/hooks/queries/useMachines'
import { ScheduledWorkspace } from '@/components/ScheduledWorkspace'

export default function ScheduledPage() {
    const { api } = useAppContext()
    const { machines } = useMachines(api, true)

    return <ScheduledWorkspace api={api} machines={machines} />
}
