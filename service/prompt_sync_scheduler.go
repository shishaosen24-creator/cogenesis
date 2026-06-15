package service

import (
	"log"
	"sync"
	"time"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
	"github.com/robfig/cron/v3"
)

const defaultPromptSyncCron = "*/5 * * * *"
const publicPromptSyncCooldown = 2 * time.Minute

var (
	promptSyncCron          *cron.Cron
	promptSyncOnce          sync.Once
	promptSyncMu            sync.Mutex
	publicPromptSyncMu      sync.Mutex
	publicPromptSyncRunning bool
	publicPromptSyncLast    time.Time
)

type PromptSyncResult struct {
	SyncedCategories int      `json:"syncedCategories"`
	FailedCategories int      `json:"failedCategories"`
	Skipped          bool     `json:"skipped"`
	Message          string   `json:"message"`
	UpdatedAt        string   `json:"updatedAt"`
	Errors           []string `json:"errors"`
}

func StartPromptSyncScheduler() {
	promptSyncOnce.Do(func() {
		promptSyncCron = cron.New()
		promptSyncCron.Start()
	})
	RefreshPromptSyncScheduler()
}

func RefreshPromptSyncScheduler() {
	promptSyncMu.Lock()
	defer promptSyncMu.Unlock()
	if promptSyncCron == nil {
		return
	}
	for _, entry := range promptSyncCron.Entries() {
		promptSyncCron.Remove(entry.ID)
	}
	settings, err := repository.GetSettings()
	if err != nil {
		log.Printf("load prompt sync setting failed err=%v", err)
		return
	}
	setting := normalizePromptSyncSetting(settings.Private.PromptSync)
	if setting.Enabled == nil || !*setting.Enabled {
		return
	}
	if _, err := promptSyncCron.AddFunc(setting.Cron, func() {
		SyncRemotePromptCategories()
	}); err != nil {
		log.Printf("add prompt sync cron failed cron=%s err=%v", setting.Cron, err)
	}
}

func SyncRemotePromptCategories() PromptSyncResult {
	result := PromptSyncResult{UpdatedAt: time.Now().Format(time.RFC3339)}
	for _, category := range repository.PromptCategories() {
		if !category.Remote {
			continue
		}
		log.Printf("scheduled prompt sync start category=%s", category.Category)
		if _, err := SyncPromptCategory(category.Category); err != nil {
			log.Printf("scheduled prompt sync failed category=%s err=%v", category.Category, err)
			result.FailedCategories++
			result.Errors = append(result.Errors, category.Category)
			continue
		}
		result.SyncedCategories++
		log.Printf("scheduled prompt sync done category=%s", category.Category)
	}
	if result.FailedCategories > 0 {
		result.Message = "部分远程提示词源同步失败"
	} else {
		result.Message = "远程提示词源已同步"
	}
	return result
}

func SyncRemotePromptCategoriesPublic() (PromptSyncResult, error) {
	publicPromptSyncMu.Lock()
	if publicPromptSyncRunning {
		publicPromptSyncMu.Unlock()
		return PromptSyncResult{}, safeMessageError{message: "提示词库正在联网更新，请稍后再试"}
	}
	if !publicPromptSyncLast.IsZero() && time.Since(publicPromptSyncLast) < publicPromptSyncCooldown {
		publicPromptSyncMu.Unlock()
		return PromptSyncResult{Skipped: true, Message: "提示词库刚刚更新过，已使用最新缓存", UpdatedAt: publicPromptSyncLast.Format(time.RFC3339)}, nil
	}
	publicPromptSyncRunning = true
	publicPromptSyncMu.Unlock()

	defer func() {
		publicPromptSyncMu.Lock()
		publicPromptSyncRunning = false
		publicPromptSyncMu.Unlock()
	}()

	result := SyncRemotePromptCategories()
	publicPromptSyncMu.Lock()
	publicPromptSyncLast = time.Now()
	result.UpdatedAt = publicPromptSyncLast.Format(time.RFC3339)
	publicPromptSyncMu.Unlock()
	return result, nil
}

func normalizePromptSyncSetting(setting model.PromptSyncSetting) model.PromptSyncSetting {
	if setting.Cron == "" {
		setting.Cron = defaultPromptSyncCron
	}
	if setting.Enabled == nil {
		enabled := true
		setting.Enabled = &enabled
	}
	return setting
}
