export interface DataTableSkeletonProps {
    rowCount?: number;
    columnCount?: number;
}

export function DataTableSkeleton({ rowCount = 5, columnCount = 5 }: DataTableSkeletonProps) {
    return (
        <div className="w-full">
            <div className="glass-card overflow-hidden">
                {/* Skeleton Header */}
                <div className="grid border-b border-bg-intermediate px-6 py-4" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                    {Array.from({ length: columnCount }).map((_, i) => (
                        <div key={`header-${i}`} className="h-4 bg-bg-intermediate rounded animate-pulse w-3/4"></div>
                    ))}
                </div>

                {/* Skeleton Rows */}
                <div className="flex flex-col">
                    {Array.from({ length: rowCount }).map((_, rowIndex) => (
                        <div
                            key={`row-${rowIndex}`}
                            className={`grid px-6 py-4 items-center ${rowIndex !== rowCount - 1 ? 'border-b border-bg-intermediate' : ''}`}
                            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                        >
                            {Array.from({ length: columnCount }).map((_, colIndex) => (
                                <div key={`cell-${rowIndex}-${colIndex}`} className="pr-4">
                                    <div className={`h-4 bg-bg-intermediate rounded animate-pulse ${colIndex === 0 ? 'w-full' :
                                            colIndex === columnCount - 1 ? 'w-1/2 ml-auto' :
                                                'w-full max-w-[80%]'
                                        }`}></div>
                                    {/* Simulate secondary line on some cells, like the first one (name/email) */}
                                    {colIndex === 0 && (
                                        <div className="h-3 bg-bg-intermediate/60 rounded animate-pulse w-2/3 mt-2"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
