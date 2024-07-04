import * as React from 'react';
export interface ProgressProps {
    prefixCls: string;
    percent: number;
}
export default function Progress({ percent, prefixCls }: ProgressProps): React.JSX.Element | null;
