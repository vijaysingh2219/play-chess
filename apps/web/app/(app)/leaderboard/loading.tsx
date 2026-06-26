import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';

export default function Loading() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>

      {/* Table skeleton */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Rating</TableHead>
            <TableHead className="text-center">Wins</TableHead>
            <TableHead className="text-center">Draws</TableHead>
            <TableHead className="text-center">Losses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-5 w-5" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-6 w-12" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-6 w-10" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-6 w-10" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-6 w-10" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
