package links

import "testing"

func TestNormalizeWhatsApp(t *testing.T) {
	cases := []struct{ in, want string }{
		{"+86 133 8861 4562", "8613388614562"},
		{"+86-133-8861-4562", "8613388614562"},
		{"(+86) 133 8861 4562", "8613388614562"},
		{"8613388614562", "8613388614562"},
		{"  +1 (555) 123-4567 ", "15551234567"},
		{"", ""},
		{"abc", ""},
	}
	for _, c := range cases {
		if got := NormalizeWhatsApp(c.in); got != c.want {
			t.Errorf("NormalizeWhatsApp(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestWhatsAppLink(t *testing.T) {
	link := WhatsAppLink("+86 133 8861 4562", "Hello, I want caps")
	want := "https://wa.me/8613388614562?text=" + "Hello%2C+I+want+caps"
	if link != want {
		t.Errorf("WhatsAppLink = %q, want %q", link, want)
	}
	if got := WhatsAppLink("", "x"); got != "" {
		t.Errorf("empty number should yield empty link, got %q", got)
	}
	if got := WhatsAppLink("+8613388614562", ""); got != "https://wa.me/8613388614562" {
		t.Errorf("no text should yield bare link, got %q", got)
	}
}
