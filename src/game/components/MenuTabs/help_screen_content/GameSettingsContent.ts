import { ContentSection } from "../ContentSection";

export const gameSettingsContent: ContentSection = {
    Header: {
        key: 'help_game-settings',
        value: 'Game Settings',
    },
    Border: {
        opts: {
            margin: { top: 12, bottom: 12 },
            padding: 20,
        },
    },
    Content: [
        {
            Header: 
            {
                key: 'help_paylines-title',
                value: 'Paylines',
            }
        },
        {
            Text: {
                opts: {
                    padding: { top: 20, bottom: 20 },
                },
                key: 'help_paylines-desc',
                value: 'Symbols can land anywhere on the screen.',
            }
        },
        {
            Image: {
                opts: {
                    padding: { top: 20, bottom: 20 },
                    align: 0.5,
                    anchor: { x: 0.5, y: 0 },
                    size: 'fitToWidth',
                },
                key: 'paylineMobileWin',
            },
        },
        {
            Image: {
                opts: {
                    padding: { top: 20, bottom: 20 },
                    align: 0.5,
                    anchor: { x: 0.5, y: 0 },
                    size: 'fitToWidth',
                },
                key: 'paylineMobileNoWin',
            },
        },
        {
            Text: {
                opts: {
                    padding: { top: 40, bottom: 10 },
                },
                key: 'help_wins-multiplied',
                value: 'All wins are multiplied by the base bet.',
            }
        },
        {
            Text: {
                opts: {
                    padding: { top: 10, bottom: 10 },
                },
                key: 'help_wins-combined',
                value: 'When multiple symbol wins occur, all values are combined into the total win.',
            }
        },
        {
            Text: {
                opts: {
                    padding: { top: 10 },
                },
                key: 'help_freespins-rewards',
                value: 'Free spins rewards are granted after the round ends.',
            }
        }
    ]
};
