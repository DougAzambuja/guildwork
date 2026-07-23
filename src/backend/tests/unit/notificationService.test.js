// Testes unitários do notificationService com mocks do Mongoose.
const Notification = require('../../models/notification');
const User         = require('../../models/user');
const svc          = require('../../services/notificationService');

jest.mock('../../models/notification', () => ({
    create:  jest.fn(),
    findOne: jest.fn(),
}));

jest.mock('../../models/user', () => ({
    findById:          jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));

const mockUserWithAchievements = (achievements = []) => ({
    select: jest.fn().mockResolvedValue({ achievements }),
});

beforeEach(() => {
    jest.clearAllMocks();
    Notification.create.mockResolvedValue({ _id: 'notif_id' });
    Notification.findOne.mockResolvedValue(null);
    User.findById.mockReturnValue(mockUserWithAchievements());
    User.findByIdAndUpdate.mockResolvedValue({});
});

describe('notifyQuestAssigned', () => {
    it('deve criar notificação do tipo quest_assigned', async () => {
        await svc.notifyQuestAssigned({ _id: 'q1', title: 'Quest X' }, 'user_1');

        expect(Notification.create).toHaveBeenCalledTimes(1);
        const args = Notification.create.mock.calls[0][0];
        expect(args.type).toBe('quest_assigned');
        expect(args.user_id).toBe('user_1');
        expect(args.meta).toMatchObject({ quest_id: 'q1' });
    });
});

describe('notifyLevelUp', () => {
    it('deve criar notificação de level_up com nível correto', async () => {
        await svc.notifyLevelUp('user_2', 5);

        const args = Notification.create.mock.calls[0][0];
        expect(args.type).toBe('level_up');
        expect(args.meta).toMatchObject({ level: 5 });
        expect(args.message).toMatch(/5/);
    });
});

describe('notifyContributorReward', () => {
    it('deve criar notificação do tipo contributor_reward', async () => {
        await svc.notifyContributorReward('user_3', 'Quest Y', 50, 5);

        const args = Notification.create.mock.calls[0][0];
        expect(args.type).toBe('contributor_reward');
        expect(args.user_id).toBe('user_3');
        expect(args.meta).toMatchObject({ xp: 50, coins: 5 });
        expect(args.message).toMatch(/50 XP/);
        expect(args.message).toMatch(/5 Gold/);
    });
});

describe('checkAndNotifyAchievement', () => {
    it('deve conceder conquista first_quest na primeira missão', async () => {
        User.findById.mockReturnValue(mockUserWithAchievements([]));

        await svc.checkAndNotifyAchievement('user_4', 1);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user_4', expect.objectContaining({
            $push: expect.objectContaining({ achievements: expect.objectContaining({ key: 'first_quest' }) }),
        }));
        expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
            type: 'achievement',
        }));
    });

    it('não deve conceder conquista já desbloqueada', async () => {
        User.findById.mockReturnValue(mockUserWithAchievements([
            { key: 'first_quest', title: 'Estreante', unlocked_at: new Date() },
        ]));

        await svc.checkAndNotifyAchievement('user_5', 1);

        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(Notification.create).not.toHaveBeenCalled();
    });

    it('deve conceder múltiplas conquistas quando ultrapassar vários marcos', async () => {
        User.findById.mockReturnValue(mockUserWithAchievements([]));

        await svc.checkAndNotifyAchievement('user_6', 10);

        // Deve ter concedido: first_quest (1), quests_5 (5), quests_10 (10)
        expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(3);
        expect(Notification.create).toHaveBeenCalledTimes(3);
    });
});

describe('notifySlaWarning', () => {
    it('deve criar notificação de SLA se nenhuma foi enviada nas últimas 24h', async () => {
        Notification.findOne.mockResolvedValue(null);

        const result = await svc.notifySlaWarning({ _id: 'q2', title: 'Quest SLA' }, 'user_7');

        expect(result).toBe(true);
        expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
            type: 'sla_warning',
        }));
    });

    it('não deve criar notificação de SLA duplicada em 24h', async () => {
        Notification.findOne.mockResolvedValue({ _id: 'existing_notif' });

        const result = await svc.notifySlaWarning({ _id: 'q3', title: 'Quest SLA' }, 'user_8');

        expect(result).toBe(false);
        expect(Notification.create).not.toHaveBeenCalled();
    });
});

describe('ALL_ACHIEVEMENTS', () => {
    it('deve exportar todos os marcos de conquista', () => {
        expect(Array.isArray(svc.ALL_ACHIEVEMENTS)).toBe(true);
        expect(svc.ALL_ACHIEVEMENTS.length).toBeGreaterThan(0);

        const keys = svc.ALL_ACHIEVEMENTS.map(a => a.key);
        expect(keys).toContain('first_quest');
        expect(keys).toContain('quests_5');
        expect(keys).toContain('quests_50');
    });
});
