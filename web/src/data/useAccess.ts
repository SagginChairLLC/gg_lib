import { create } from 'zustand';

/** What a player without access is shown: their identifier and where it goes. */
type AccessState = {
    open: boolean;
    identifier: string;
    file: string;
};

export const useAccess = create<AccessState>(() => ({
    open: false,
    identifier: '',
    file: '',
}));

export function showAccess(data: { IDENTIFIER?: string; FILE?: string }) {
    useAccess.setState({
        open: true,
        identifier: data.IDENTIFIER ?? '',
        file: data.FILE ?? '',
    });
}

export function hideAccess() {
    useAccess.setState({ open: false });
}
