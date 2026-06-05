/**
 * TokenSystem - Manages game tokens on tiles
 * 
 * Handles:
 * - Token placement when tiles are explored
 * - Search action when heroes are on a tile with tokens
 * - Reveal logic for coffin tokens (Scenario 1)
 * - Integration with victory conditions
 */

import { GameToken, TokenSearchResult, TokenType, Position, GameState } from '../types'
import { getTokenAsset, COFFIN_TOKENS } from '../../data/tokenMap'

export interface TokenPlacementConfig {
    type: TokenType
    count: number
    placement: 'random_tile' | 'start_tile' | 'explored_tiles'
}

export class TokenSystem {
    /**
     * Initialize coffin token pool for Scenario 1
     * Called at game start to prepare the randomized coffin deck
     */
    static initializeCoffinDeck(gameState: GameState): GameState {
        // Get all coffin token types
        const coffinTypes = [...COFFIN_TOKENS]

        // Shuffle the coffin types
        for (let i = coffinTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [coffinTypes[i], coffinTypes[j]] = [coffinTypes[j], coffinTypes[i]]
        }

        // Store as unplaced tokens
        const unplacedCoffinTokens = coffinTypes.map(c => ({
            id: c.id,
            name: c.name,
            isStrahds: c.id === 'coffin_strahd'
        }))

        return {
            ...gameState,
            unplacedCoffinTokens,
            strahdsCoffinTokenId: null // reset
        }
    }

    /**
     * Get next coffin token to place on a newly explored tile
     */
    static getNextCoffinToken(gameState: GameState): { tokenInfo: { id: string; name: string; isStrahds: boolean } | null, newState: GameState } {
        if (!gameState.unplacedCoffinTokens || gameState.unplacedCoffinTokens.length === 0) {
            return { tokenInfo: null, newState: gameState }
        }
        
        const tokens = [...gameState.unplacedCoffinTokens]
        const tokenInfo = tokens.shift() || null
        
        return { 
            tokenInfo, 
            newState: { ...gameState, unplacedCoffinTokens: tokens } 
        }
    }

    /**
     * Place a coffin token on a newly explored tile
     * Called by ExplorationStateMachine when a tile is placed
     */
    static placeCoffinOnNewTile(gameState: GameState, tileId: string, tileX: number, tileZ: number): { token: GameToken | null, newState: GameState } {
        // Check if this scenario uses coffin tokens (Scenario 1)
        const scenarioId = gameState.activeScenario?.id
        if (scenarioId !== 's1' && scenarioId !== 'scenario1' && scenarioId !== 'scenario-1') {
            return { token: null, newState: gameState }
        }

        // Get next coffin from the deck
        const { tokenInfo, newState } = this.getNextCoffinToken(gameState)
        if (!tokenInfo) return { token: null, newState }

        const tokenAsset = getTokenAsset(tokenInfo.id)

        const newToken: GameToken = {
            id: `token_${tokenInfo.id}_${Date.now()}`,
            type: 'coffin',
            name: 'Coffin', // Unrevealed name
            tileId,
            position: {
                x: tileX,
                z: tileZ,
                sqX: 1 + Math.floor(Math.random() * 2), // Random position within tile
                sqZ: 1 + Math.floor(Math.random() * 2)
            },
            isRevealed: true, // Visible on the tile
            isSearched: false,
            imageUrl: tokenAsset?.backImage || '/assets/tokens/Token_Misc_CoffinBack.png',
            metadata: {
                isStrahdsCoffin: tokenInfo.isStrahds,
                tokenId: tokenInfo.id
            }
        }

        // Add to game state
        const currentTokens = newState.tokens || []
        return {
            token: newToken,
            newState: {
                ...newState,
                tokens: [...currentTokens, newToken],
                strahdsCoffinTokenId: tokenInfo.isStrahds ? newToken.id : newState.strahdsCoffinTokenId
            }
        }
    }

    /**
     * Initialize tokens for a scenario
     * For Scenario 1, prepares the coffin deck for placement during exploration
     */
    static initializeScenarioTokens(gameState: GameState, scenarioId: string): GameState {
        if (scenarioId === 's1' || scenarioId === 'scenario1' || scenarioId === 'scenario-1') {
            // Initialize the coffin deck for placement during exploration
            const stateWithDeck = this.initializeCoffinDeck(gameState)
            
            return {
                ...stateWithDeck,
                tokens: []
            }
        }

        return gameState
    }

    /**
     * Place a token on a specific tile (called when tile is explored)
     */
    static placeTokenOnTile(
        gameState: GameState,
        tileId: string,
        tokenType: TokenType,
        position: Position,
        name: string = 'Unknown Token'
    ): { token: GameToken | null, newState: GameState } {
        const newToken: GameToken = {
            id: `token_${tokenType}_${Date.now()}`,
            type: tokenType,
            name,
            tileId,
            position,
            isRevealed: false,
            isSearched: false
        }

        // Add to game state
        const currentTokens = gameState.tokens || []
        return {
            token: newToken,
            newState: {
                ...gameState,
                tokens: [...currentTokens, newToken]
            }
        }
    }

    /**
     * Get tokens on a specific tile
     */
    static getTokensOnTile(gameState: GameState, tileId: string): GameToken[] {
        if (!gameState.tokens) return []
        return gameState.tokens.filter(t => t.tileId === tileId)
    }

    /**
     * Check if hero can search tokens on their current tile
     */
    static canSearchTokens(gameState: GameState, heroId: string): { canSearch: boolean; reason: string; tokens: GameToken[] } {
        const hero = gameState.heroes.find(h => h.id === heroId)
        if (!hero) {
            return { canSearch: false, reason: 'Hero not found', tokens: [] }
        }

        // Get tokens on hero's tile that haven't been searched
        const tokensOnTile = this.getTokensOnTile(
            gameState,
            gameState.tiles.find(t =>
                t.x === hero.position.x && t.z === hero.position.z
            )?.id || ''
        ).filter(t => !t.isSearched)

        if (tokensOnTile.length === 0) {
            return { canSearch: false, reason: 'No searchable tokens on this tile', tokens: [] }
        }

        return { canSearch: true, reason: '', tokens: tokensOnTile }
    }

    /**
     * Search a token - reveal its contents
     * This is the main action when a hero searches a coffin
     */
    static searchToken(gameState: GameState, tokenId: string): { result: TokenSearchResult | null, newState: GameState } {
        const token = gameState.tokens?.find(t => t.id === tokenId)
        if (!token) {
            return {
                result: {
                    tokenId,
                    tokenType: 'coffin',
                    success: false,
                    message: 'Token not found'
                },
                newState: gameState
            }
        }

        // Mark as searched and revealed
        const tokenAsset = token.metadata?.tokenId ? getTokenAsset(token.metadata.tokenId as string) : undefined

        const updatedTokens = (gameState.tokens || []).map(t => {
            if (t.id === tokenId) {
                return {
                    ...t,
                    isRevealed: true,
                    isSearched: true,
                    name: tokenAsset?.name || t.name,
                    imageUrl: tokenAsset?.frontImage || t.imageUrl
                }
            }
            return t
        })

        let newState: GameState = {
            ...gameState,
            tokens: updatedTokens
        }

        // Handle Strahd's coffin discovery
        if (token.metadata?.isStrahdsCoffin) {
            return {
                result: {
                    tokenId: token.id,
                    tokenType: token.type,
                    success: true,
                    message: "YOU HAVE FOUND STRAHD'S COFFIN! This is the resting place of the vampire lord!",
                    revealedData: {
                        isStrahdsCoffin: true
                    }
                },
                newState
            }
        }

        // Handle other coffin types
        const coffinType = (token.metadata?.tokenId as string)?.replace('coffin_', '') || ''
        let message = `You searched the coffin: ${tokenAsset?.name || 'Unknown'}`;
        let revealedData: any = undefined;

        // Strahd awakens after 4 coffins searched
        const searchedCoffinCount = updatedTokens.filter(t => t.type === 'coffin' && t.isSearched).length;
        if (searchedCoffinCount >= 4 && !newState.strahdAwakened) {
          newState = { ...newState, strahdAwakened: true };
        }
        
        switch (coffinType) {
            case 'empty':
                message = 'This coffin is empty. Dust and cobwebs fill the interior.';
                break;
            case 'treasure':
                message = 'You found a treasure hidden in this coffin!';
                revealedData = { itemId: 'treasure_card' };
                break;
            case 'trap':
                message = 'A trap springs from the coffin!';
                revealedData = { trapId: 'coffin_trap' };
                break;
            case 'monster':
                message = 'A monster emerges from the coffin!';
                revealedData = { itemId: 'monster_spawn' };
                break;
            case 'holy_water':
                message = 'You found a vial of Holy Water!';
                revealedData = { itemId: 'holy_water' };
                break;
            case 'wooden_stake':
                message = 'You found a Wooden Stake - perfect for slaying vampires!';
                revealedData = { itemId: 'wooden_stake' };
                break;
        }
        
        return {
            result: {
                tokenId: token.id,
                tokenType: token.type,
                success: true,
                message,
                revealedData
            },
            newState
        }
    }

    /**
     * Check victory condition for Scenario 1
     * Returns true if Strahd's coffin has been found
     */
    static checkCoffinVictory(gameState: GameState): { isVictory: boolean; message: string } {
        const strahdTokenId = gameState.strahdsCoffinTokenId
        if (!strahdTokenId) return { isVictory: false, message: '' }

        const strahdToken = gameState.tokens?.find(t => t.id === strahdTokenId)

        if (strahdToken?.isSearched && strahdToken?.metadata?.isStrahdsCoffin) {
            return {
                isVictory: true,
                message: "Victory! You have found Strahd's Coffin and can now confront the vampire lord!"
            }
        }

        return { isVictory: false, message: '' }
    }

    /**
     * Get unplaced tokens of a specific type
     */
    private static getUnplacedTokens(tokenType: TokenType): { id: string; name: string }[] {
        if (tokenType === 'coffin') {
            return COFFIN_TOKENS.map(t => ({ id: t.id, name: t.name }))
        }
        return []
    }
}
