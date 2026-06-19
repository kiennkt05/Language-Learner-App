def update_card_sm2(repetitions: int, interval: int, ease_factor: float, quality: int) -> tuple[int, int, float]:
    """
    Applies the SuperMemo-2 (SM-2) algorithm.
    quality: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
    Returns: (new_repetitions, new_interval, new_ease_factor)
    """
    # If the response is incorrect (quality < 3), reset repetitions and interval
    if quality < 3:
        new_reps = 0
        new_interval = 1
    else:
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ease_factor)
        new_reps = repetitions + 1
        
    # Calculate ease factor
    # Formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)  # Minimum ease factor is 1.3
    
    return new_reps, new_interval, new_ef
