/**
 * Hard-coded spin payload used for manual testing.
 * Mirrors a high-value base spin that also unlocks a long free-spin sequence.
 * The numbers come directly from QA logs so designers can reproduce the scenario.
 */

export const BONUS_FREE_SPIN_TEST_DATA = {
  playerId: 'debug-player',
  "bet": "1",
    "slot": {
        "area": [
            [
                1,
                2,
                3,
                0,
                4
            ],
            [
                0,
                8,
                7,
                5,
                6
            ],
            [
                1,
                2,
                9,
                3,
                9
            ],
            [
                2,
                3,
                9,
                1,
                4
            ],
            [
                6,
                5,
                0,
                7,
                8
            ],
            [
                3,
                9,
                2,
                0,
                1
            ]
        ],
        "totalWin": 34.25,
        "tumbles": {
            "items": [],
            "multiplier": {
                "symbols": [],
                "total": 0
            }
        },
        "freeSpin": {
            "multiplierValue": 3,
            "items": [
                {
                    "spinsLeft": 15,
                    "multiplier": 0,
                    "area": [
                        [
                            6,
                            8,
                            8,
                            9,
                            9
                        ],
                        [
                            9,
                            9,
                            6,
                            6,
                            8
                        ],
                        [
                            7,
                            9,
                            9,
                            5,
                            5
                        ],
                        [
                            7,
                            7,
                            5,
                            5,
                            8
                        ],
                        [
                            6,
                            6,
                            14,
                            4,
                            4
                        ],
                        [
                            7,
                            5,
                            5,
                            8,
                            8
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 5
                    }
                },
                {
                    "spinsLeft": 14,
                    "multiplier": 0,
                    "area": [
                        [
                            6,
                            9,
                            9,
                            0,
                            2
                        ],
                        [
                            3,
                            3,
                            7,
                            7,
                            5
                        ],
                        [
                            9,
                            4,
                            4,
                            2,
                            2
                        ],
                        [
                            6,
                            6,
                            8,
                            8,
                            4
                        ],
                        [
                            5,
                            8,
                            8,
                            9,
                            9
                        ],
                        [
                            8,
                            9,
                            9,
                            7,
                            7
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 0
                    }
                },
                {
                    "spinsLeft": 13,
                    "multiplier": 0,
                    "area": [
                        [
                            5,
                            8,
                            8,
                            7,
                            7
                        ],
                        [
                            5,
                            4,
                            4,
                            6,
                            6
                        ],
                        [
                            4,
                            2,
                            2,
                            7,
                            7
                        ],
                        [
                            2,
                            2,
                            9,
                            9,
                            8
                        ],
                        [
                            3,
                            3,
                            9,
                            9,
                            8
                        ],
                        [
                            8,
                            8,
                            0,
                            7,
                            7
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 0
                    }
                },
                {
                    "spinsLeft": 12,
                    "multiplier": 0,
                    "area": [
                        [
                            3,
                            6,
                            6,
                            8,
                            8
                        ],
                        [
                            9,
                            9,
                            6,
                            6,
                            8
                        ],
                        [
                            7,
                            9,
                            9,
                            5,
                            5
                        ],
                        [
                            9,
                            9,
                            9,
                            6,
                            6
                        ],
                        [
                            9,
                            9,
                            7,
                            7,
                            5
                        ],
                        [
                            4,
                            7,
                            7,
                            8,
                            8
                        ]
                    ],
                    "totalWin": 0.25,
                    "tumble": {
                        "items": [
                            {
                                "symbols": {
                                    "in": [
                                        [],
                                        [
                                            7,
                                            7
                                        ],
                                        [
                                            9,
                                            1
                                        ],
                                        [
                                            8,
                                            9,
                                            9
                                        ],
                                        [
                                            9,
                                            3
                                        ],
                                        []
                                    ],
                                    "out": [
                                        {
                                            "symbol": 9,
                                            "count": 9,
                                            "win": 0.25
                                        }
                                    ]
                                },
                                "win": 0.25
                            }
                        ],
                        "multiplier": 0
                    }
                },
                {
                    "spinsLeft": 11,
                    "multiplier": 0,
                    "area": [
                        [
                            1,
                            1,
                            5,
                            5,
                            8
                        ],
                        [
                            6,
                            8,
                            8,
                            6,
                            6
                        ],
                        [
                            5,
                            9,
                            9,
                            4,
                            4
                        ],
                        [
                            5,
                            2,
                            2,
                            9,
                            9
                        ],
                        [
                            7,
                            7,
                            6,
                            6,
                            11
                        ],
                        [
                            8,
                            9,
                            9,
                            7,
                            7
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 2
                    }
                },
                {
                    "spinsLeft": 10,
                    "multiplier": 0,
                    "area": [
                        [
                            1,
                            1,
                            5,
                            5,
                            8
                        ],
                        [
                            7,
                            2,
                            2,
                            12,
                            8
                        ],
                        [
                            2,
                            7,
                            7,
                            9,
                            9
                        ],
                        [
                            9,
                            8,
                            8,
                            1,
                            1
                        ],
                        [
                            3,
                            3,
                            9,
                            9,
                            8
                        ],
                        [
                            7,
                            5,
                            5,
                            9,
                            9
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 3
                    }
                },
                {
                    "spinsLeft": 9,
                    "multiplier": 5,
                    "area": [
                        [
                            4,
                            4,
                            6,
                            6,
                            9
                        ],
                        [
                            9,
                            9,
                            3,
                            3,
                            7
                        ],
                        [
                            9,
                            9,
                            9,
                            9,
                            6
                        ],
                        [
                            8,
                            4,
                            4,
                            11,
                            7
                        ],
                        [
                            6,
                            6,
                            12,
                            4,
                            4
                        ],
                        [
                            2,
                            2,
                            9,
                            9,
                            7
                        ]
                    ],
                    "totalWin": 1.25,
                    "tumble": {
                        "items": [
                            {
                                "symbols": {
                                    "in": [
                                        [
                                            7
                                        ],
                                        [
                                            2,
                                            7
                                        ],
                                        [
                                            9,
                                            7,
                                            7,
                                            2
                                        ],
                                        [],
                                        [],
                                        [
                                            8,
                                            8
                                        ]
                                    ],
                                    "out": [
                                        {
                                            "symbol": 9,
                                            "count": 9,
                                            "win": 0.25
                                        }
                                    ]
                                },
                                "win": 0.25
                            }
                        ],
                        "multiplier": 5
                    }
                },
                {
                    "spinsLeft": 8,
                    "multiplier": 5,
                    "area": [
                        [
                            9,
                            0,
                            2,
                            2,
                            7
                        ],
                        [
                            7,
                            5,
                            5,
                            4,
                            4
                        ],
                        [
                            2,
                            7,
                            7,
                            9,
                            9
                        ],
                        [
                            2,
                            2,
                            9,
                            9,
                            8
                        ],
                        [
                            7,
                            5,
                            5,
                            8,
                            8
                        ],
                        [
                            7,
                            7,
                            4,
                            4,
                            1
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 0
                    }
                },
                {
                    "spinsLeft": 7,
                    "multiplier": 5,
                    "area": [
                        [
                            5,
                            8,
                            8,
                            7,
                            7
                        ],
                        [
                            9,
                            9,
                            6,
                            6,
                            8
                        ],
                        [
                            9,
                            4,
                            4,
                            2,
                            2
                        ],
                        [
                            3,
                            8,
                            8,
                            6,
                            6
                        ],
                        [
                            7,
                            7,
                            5,
                            5,
                            8
                        ],
                        [
                            7,
                            7,
                            4,
                            4,
                            1
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 0
                    }
                },
                {
                    "spinsLeft": 6,
                    "multiplier": 7,
                    "area": [
                        [
                            0,
                            2,
                            2,
                            7,
                            7
                        ],
                        [
                            3,
                            7,
                            7,
                            5,
                            5
                        ],
                        [
                            9,
                            4,
                            4,
                            2,
                            2
                        ],
                        [
                            1,
                            7,
                            7,
                            3,
                            3
                        ],
                        [
                            11,
                            4,
                            4,
                            9,
                            9
                        ],
                        [
                            9,
                            9,
                            7,
                            7,
                            5
                        ]
                    ],
                    "totalWin": 5.25,
                    "tumble": {
                        "items": [
                            {
                                "symbols": {
                                    "in": [
                                        [
                                            3,
                                            9
                                        ],
                                        [
                                            9,
                                            8
                                        ],
                                        [],
                                        [
                                            9,
                                            9
                                        ],
                                        [],
                                        [
                                            8,
                                            8
                                        ]
                                    ],
                                    "out": [
                                        {
                                            "symbol": 7,
                                            "count": 8,
                                            "win": 0.5
                                        }
                                    ]
                                },
                                "win": 0.5
                            },
                            {
                                "symbols": {
                                    "in": [
                                        [
                                            6
                                        ],
                                        [
                                            8
                                        ],
                                        [
                                            7
                                        ],
                                        [
                                            9,
                                            6
                                        ],
                                        [
                                            8,
                                            8
                                        ],
                                        [
                                            6,
                                            3
                                        ]
                                    ],
                                    "out": [
                                        {
                                            "symbol": 9,
                                            "count": 9,
                                            "win": 0.25
                                        }
                                    ]
                                },
                                "win": 0.25
                            }
                        ],
                        "multiplier": 2
                    }
                },
                {
                    "spinsLeft": 5,
                    "multiplier": 7,
                    "area": [
                        [
                            1,
                            1,
                            5,
                            5,
                            8
                        ],
                        [
                            7,
                            7,
                            5,
                            5,
                            4
                        ],
                        [
                            9,
                            7,
                            7,
                            5,
                            5
                        ],
                        [
                            1,
                            7,
                            7,
                            3,
                            3
                        ],
                        [
                            5,
                            6,
                            6,
                            1,
                            1
                        ],
                        [
                            9,
                            8,
                            8,
                            0,
                            7
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 0
                    }
                },
                {
                    "spinsLeft": 4,
                    "multiplier": 7,
                    "area": [
                        [
                            6,
                            6,
                            5,
                            5,
                            8
                        ],
                        [
                            5,
                            5,
                            7,
                            7,
                            4
                        ],
                        [
                            9,
                            9,
                            6,
                            6,
                            8
                        ],
                        [
                            4,
                            4,
                            11,
                            7,
                            7
                        ],
                        [
                            3,
                            3,
                            9,
                            9,
                            8
                        ],
                        [
                            9,
                            9,
                            4,
                            4,
                            8
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 2
                    }
                },
                {
                    "spinsLeft": 3,
                    "multiplier": 7,
                    "area": [
                        [
                            4,
                            4,
                            6,
                            6,
                            9
                        ],
                        [
                            1,
                            9,
                            9,
                            8,
                            8
                        ],
                        [
                            13,
                            8,
                            8,
                            6,
                            6
                        ],
                        [
                            1,
                            1,
                            7,
                            7,
                            3
                        ],
                        [
                            2,
                            9,
                            9,
                            7,
                            7
                        ],
                        [
                            7,
                            7,
                            8,
                            8,
                            2
                        ]
                    ],
                    "totalWin": 0,
                    "tumble": {
                        "items": [],
                        "multiplier": 4
                    }
                },
                {
                    "spinsLeft": 2,
                    "multiplier": 7,
                    "area": [
                        [
                            7,
                            7,
                            4,
                            4,
                            6
                        ],
                        [
                            1,
                            1,
                            9,
                            9,
                            8
                        ],
                        [
                            7,
                            7,
                            9,
                            9,
                            5
                        ],
                        [
                            8,
                            5,
                            5,
                            2,
                            2
                        ],
                        [
                            8,
                            9,
                            9,
                            7,
                            7
                        ],
                        [
                            5,
                            8,
                            8,
                            9,
                            9
                        ]
                    ],
                    "totalWin": 1.75,
                    "tumble": {
                        "items": [
                            {
                                "symbols": {
                                    "in": [
                                        [],
                                        [
                                            7,
                                            6
                                        ],
                                        [
                                            3,
                                            6
                                        ],
                                        [],
                                        [
                                            8,
                                            8
                                        ],
                                        [
                                            3,
                                            9
                                        ]
                                    ],
                                    "out": [
                                        {
                                            "symbol": 9,
                                            "count": 8,
                                            "win": 0.25
                                        }
                                    ]
                                },
                                "win": 0.25
                            }
                        ],
                        "multiplier": 0
                    }
                },
                {
                    "spinsLeft": 1,
                    "multiplier": 13,
                    "area": [
                        [
                            9,
                            1,
                            1,
                            5,
                            5
                        ],
                        [
                            6,
                            7,
                            7,
                            2,
                            2
                        ],
                        [
                            5,
                            5,
                            11,
                            8,
                            8
                        ],
                        [
                            1,
                            1,
                            7,
                            7,
                            3
                        ],
                        [
                            9,
                            9,
                            7,
                            7,
                            5
                        ],
                        [
                            7,
                            7,
                            5,
                            5,
                            8
                        ]
                    ],
                    "totalWin": 22.75,
                    "tumble": {
                        "items": [
                            {
                                "symbols": {
                                    "in": [
                                        [],
                                        [
                                            4,
                                            4
                                        ],
                                        [],
                                        [
                                            6,
                                            9
                                        ],
                                        [
                                            5,
                                            8
                                        ],
                                        [
                                            9,
                                            9
                                        ]
                                    ],
                                    "out": [
                                        {
                                            "symbol": 7,
                                            "count": 8,
                                            "win": 0.5
                                        }
                                    ]
                                },
                                "win": 0.5
                            },
                            {
                                "symbols": {
                                    "in": [
                                        [
                                            6,
                                            6
                                        ],
                                        [],
                                        [
                                            7,
                                            7
                                        ],
                                        [],
                                        [
                                            1,
                                            6
                                        ],
                                        [
                                            9,
                                            9
                                        ]
                                    ],
                                    "out": [
                                        {
                                            "symbol": 5,
                                            "count": 8,
                                            "win": 1
                                        }
                                    ]
                                },
                                "win": 1
                            },
                            {
                                "symbols": {
                                    "in": [
                                        [
                                            7
                                        ],
                                        [],
                                        [],
                                        [
                                            11
                                        ],
                                        [
                                            11,
                                            6
                                        ],
                                        [
                                            8,
                                            8,
                                            5,
                                            5
                                        ]
                                    ],
                                    "out": [
                                        {
                                            "symbol": 9,
                                            "count": 8,
                                            "win": 0.25
                                        }
                                    ]
                                },
                                "win": 0.25
                            }
                        ],
                        "multiplier": 6
                    }
                }
            ]
        }
    }
};

// Provide lowercase freespin alias expected by several systems.
(BONUS_FREE_SPIN_TEST_DATA.slot as any).freespin = BONUS_FREE_SPIN_TEST_DATA.slot.freeSpin;


