package captcha

import (
	"bytes"
	"errors"
	"image/png"
	"testing"
	"time"
)

func TestChallengeVerifyOnce(t *testing.T) {
	m := NewManager(time.Minute)
	ch, err := m.NewChallenge("1.2.3.4")
	if err != nil {
		t.Fatal(err)
	}
	if len(ch.Answer) != CodeLength || len(ch.ID) != 32 || ch.ExpiresIn != int(time.Minute.Seconds()) {
		t.Fatalf("unexpected challenge: id=%q answer=%q expires=%d", ch.ID, ch.Answer, ch.ExpiresIn)
	}
	img, err := png.Decode(bytes.NewReader(ch.PNG))
	if err != nil {
		t.Fatalf("captcha is not a valid png: %v", err)
	}
	if b := img.Bounds(); b.Dx() != canvasWidth || b.Dy() != canvasHeight {
		t.Errorf("image size = %dx%d", b.Dx(), b.Dy())
	}
	if err := m.Verify("1.2.3.4", ch.ID, ch.Answer); err != nil {
		t.Fatalf("correct answer rejected: %v", err)
	}
	if err := m.Verify("1.2.3.4", ch.ID, ch.Answer); !errors.Is(err, ErrInvalid) {
		t.Errorf("reused challenge should be invalid, got %v", err)
	}
}

func TestWrongAnswerConsumesChallenge(t *testing.T) {
	m := NewManager(time.Minute)
	ch, err := m.NewChallenge("ip")
	if err != nil {
		t.Fatal(err)
	}
	wrong := "0000"
	if ch.Answer == wrong {
		wrong = "1111"
	}
	if err := m.Verify("ip", ch.ID, wrong); !errors.Is(err, ErrInvalid) {
		t.Errorf("wrong answer should be invalid, got %v", err)
	}
	if err := m.Verify("ip", ch.ID, ch.Answer); !errors.Is(err, ErrInvalid) {
		t.Errorf("challenge should be consumed after a wrong attempt, got %v", err)
	}
}

func TestExpiredChallenge(t *testing.T) {
	m := NewManager(20 * time.Millisecond)
	ch, err := m.NewChallenge("ip")
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(30 * time.Millisecond)
	if err := m.Verify("ip", ch.ID, ch.Answer); !errors.Is(err, ErrInvalid) {
		t.Errorf("expired challenge should be invalid, got %v", err)
	}
}

func TestGenerateRateLimit(t *testing.T) {
	m := NewManager(time.Minute)
	for i := 0; i < 60; i++ {
		if _, err := m.NewChallenge("ip"); err != nil {
			t.Fatalf("request %d: %v", i+1, err)
		}
	}
	if _, err := m.NewChallenge("ip"); !errors.Is(err, ErrRateLimited) {
		t.Errorf("61st request should be rate limited, got %v", err)
	}
	if _, err := m.NewChallenge("another-ip"); err != nil {
		t.Errorf("other ip should not be limited: %v", err)
	}
}
