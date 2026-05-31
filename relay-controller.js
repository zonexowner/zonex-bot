document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("[data-relay-target]");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const setButtonLoading = (button, label = "Please wait…") => {
    button.disabled = true;
    button.style.cursor = "not-allowed";
    button.innerHTML = `
      <span class="flex items-center justify-center gap-2">
        <svg class="h-4 w-4 animate-spin text-[#00ff7f]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        ${label}
      </span>
    `;
  };

  const setButtonState = (button, state, originalText) => {
    if (state === "success") {
      button.innerHTML = originalText.includes("license") || originalText.includes("License") ? "Done ✓" : "Sent ✓";
      button.classList.remove("border-rose-500/50", "text-rose-500", "bg-rose-500/10");
      button.classList.add("bg-[#00ff7f]/20", "text-[#00ff7f]", "border-[#00ff7f]");
      return;
    }

    if (state === "error") {
      button.innerHTML = "TRANSMISSION ERROR";
      button.classList.remove("border-[#00ff7f]", "text-[#00ff7f]", "bg-[#00ff7f]/20");
      button.classList.add("border-rose-500/50", "text-rose-500", "bg-rose-500/10");
      return;
    }

    button.disabled = false;
    button.style.cursor = "pointer";
    button.innerHTML = originalText;
    button.classList.remove("border-rose-500/50", "text-rose-500", "bg-rose-500/10", "bg-[#00ff7f]/20");
    button.classList.add("border-[#00ff7f]", "text-[#00ff7f]");
  };

  const showFormMessage = (form, type, text) => {
    const messageNode = form.querySelector("#formMessage");
    if (!messageNode) return;
    messageNode.classList.remove(
      "hidden",
      "border-red-400/60",
      "text-red-300",
      "bg-red-400/10",
      "border-[#00ff7f]/40",
      "text-[#00ff7f]",
      "bg-[#00ff7f]/10"
    );
    if (type === "error") {
      messageNode.classList.add("border-red-400/60", "bg-red-400/10", "text-red-300");
    } else {
      messageNode.classList.add("border-[#00ff7f]/40", "bg-[#00ff7f]/10", "text-[#00ff7f]");
    }
    messageNode.textContent = text;
  };

  forms.forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const targetType = form.getAttribute("data-relay-target");
      const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector("button");
      if (!submitBtn) return;

      const originalBtnText = submitBtn.innerHTML;
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.timestamp_utc = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
      payload.source_stream = targetType;

      if (payload.email && !emailRegex.test(String(payload.email).trim())) {
        showFormMessage(form, "error", "Please provide a valid email format.");
        setButtonState(submitBtn, "reset", originalBtnText);
        return;
      }

      const requirePartner = form.getAttribute("data-require-partner") === "true";

      if (targetType === "terminal") {
        if (requirePartner) {
          const partnerOk =
            form.querySelector("#partnerRegistered")?.checked || payload.partner_registered === "on";
          if (!partnerOk) {
            showFormMessage(form, "error", "Complete broker signup and check the box first.");
            setButtonState(submitBtn, "reset", originalBtnText);
            return;
          }
        }
        if (!payload.email || !payload.mt5_account) {
          showFormMessage(form, "error", "Email and MT5 account number are required.");
          setButtonState(submitBtn, "reset", originalBtnText);
          return;
        }
        const mt5Digits = String(payload.mt5_account).trim();
        if (!/^\d{5,12}$/.test(mt5Digits)) {
          showFormMessage(form, "error", "MT5 account must be 5-12 digits.");
          setButtonState(submitBtn, "reset", originalBtnText);
          return;
        }
        if (!requirePartner && !payload.broker_id) {
          showFormMessage(form, "error", "Email, broker account ID, and MT5 account are required.");
          setButtonState(submitBtn, "reset", originalBtnText);
          return;
        }
      }

      if (targetType === "provision") {
        const partnerRegistered =
          form.querySelector("#partnerRegistered")?.checked ||
          payload.partner_registered === "on";
        if (!partnerRegistered) {
          showFormMessage(
            form,
            "error",
            "Please complete partner registration and confirm the checkbox."
          );
          setButtonState(submitBtn, "reset", originalBtnText);
          return;
        }
        if (!payload.email || !payload.mt5_account) {
          showFormMessage(form, "error", "Email and MT5 account number are required.");
          setButtonState(submitBtn, "reset", originalBtnText);
          return;
        }
        const mt5Digits = String(payload.mt5_account).trim();
        if (!/^\d{5,12}$/.test(mt5Digits)) {
          showFormMessage(form, "error", "MT5 login must be 5-12 digits (numbers only).");
          setButtonState(submitBtn, "reset", originalBtnText);
          return;
        }
      }

      setButtonLoading(
        submitBtn,
        targetType === "provision"
          ? "Activating license…"
          : targetType === "terminal"
            ? "Preparing payment…"
            : "Sending…"
      );

      try {
        if (targetType === "provision") {
          const partnerRegistered = form.querySelector("#partnerRegistered")?.checked;
          const response = await fetch("/api/license/provision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: payload.email,
              broker_id: payload.broker_id || undefined,
              mt5_account: String(payload.mt5_account).trim(),
              partner_registered: partnerRegistered,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "License activation failed.");

          form.querySelector("#email")?.setAttribute("readonly", "readonly");
          form.querySelector("#brokerId")?.setAttribute("readonly", "readonly");
          form.querySelector("#mt5Account")?.setAttribute("readonly", "readonly");
          form.querySelector("#partnerRegistered")?.setAttribute("disabled", "disabled");

          const readyStage = document.getElementById("licenseReadyStage");
          const tokenPreview = document.getElementById("activationTokenPreview");
          const manualLink = document.getElementById("onboardingManualLink");
          const onboardingUrl =
            result.onboardingUrl ||
            `/terminal/onboarding?token=${encodeURIComponent(result.activationToken || "")}`;

          if (readyStage) readyStage.classList.remove("hidden");
          if (tokenPreview && result.activationToken) {
            tokenPreview.textContent = `Token: ${result.activationToken}`;
          }
          if (manualLink) manualLink.href = onboardingUrl;

          showFormMessage(form, "success", "License active. Opening onboarding…");
          setButtonState(submitBtn, "success", originalBtnText);

          setTimeout(() => {
            window.location.href = onboardingUrl;
          }, 1800);
          return;
        }

        if (targetType === "terminal") {
          const partnerRegistered = form.querySelector("#partnerRegistered")?.checked;
          const response = await fetch("/api/checkout/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: payload.email,
              broker_id: payload.broker_id || undefined,
              mt5_account: String(payload.mt5_account).trim(),
              currency: payload.currency || "BTC",
              partner_registered: partnerRegistered,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || result.details || "Checkout failed.");

          if (result.hosted_url && /^https?:/i.test(result.hosted_url)) {
            window.location.href = result.hosted_url;
            return;
          }

          form.querySelector("#email")?.setAttribute("readonly", "readonly");
          form.querySelector("#mt5Account")?.setAttribute("readonly", "readonly");
          form.querySelector("#partnerRegistered")?.setAttribute("disabled", "disabled");
          form.querySelectorAll(".payment-tab").forEach((tab) => {
            tab.disabled = true;
          });
          submitBtn.classList.add("hidden");

          const paymentStage = document.getElementById("paymentStage");
          const paymentAmount = document.getElementById("paymentAmount");
          const paymentNetwork = document.getElementById("paymentNetwork");
          const networkLabel = document.getElementById("networkLabel");
          const walletAddress = document.getElementById("walletAddress");
          const paymentStatusText = document.getElementById("paymentStatusText");

          if (paymentStage) {
            paymentStage.classList.remove("hidden");
            paymentStage.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          if (typeof window.setCheckoutStep === "function") window.setCheckoutStep(3);
          if (paymentAmount) {
            paymentAmount.textContent = `$${Number(result.amountExpected).toFixed(2)} · ${result.currency}`;
          }
          if (paymentNetwork) paymentNetwork.textContent = `${result.network} network`;
          if (networkLabel) networkLabel.textContent = `${result.network} deposit address`;
          if (walletAddress) {
            walletAddress.textContent = result.walletAddress;
            walletAddress.dataset.checkoutActive = "true";
          }

          showFormMessage(
            form,
            "success",
            "Send the exact amount shown. We unlock your license after 1 confirmation."
          );
          setButtonState(submitBtn, "success", originalBtnText);

          const checkoutId = result.checkoutId;
          if (!checkoutId) return;

          const poll = async () => {
            try {
              const statusRes = await fetch(`/api/checkout/status/${encodeURIComponent(checkoutId)}`);
              const statusData = await statusRes.json();
              if (!statusRes.ok) return;

              if (statusData.paymentStatus === "confirmed") {
                if (typeof window.setCheckoutStep === "function") window.setCheckoutStep(4);
                if (paymentStatusText) {
                  paymentStatusText.textContent = "Payment confirmed. Opening setup…";
                  paymentStatusText.classList.add("text-[#00ff7f]");
                }
                const url =
                  statusData.onboardingUrl ||
                  `/terminal/onboarding?checkoutId=${encodeURIComponent(checkoutId)}`;
                window.location.href = url;
                return;
              }
            } catch (pollErr) {
              console.warn("Payment status poll:", pollErr);
            }
          };

          poll();
          window.setInterval(poll, 8000);
          return;
        }

        const relayResponse = await fetch("/api/relay/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, payload }),
        });
        const relayResult = await relayResponse.json();
        if (!relayResponse.ok) throw new Error(relayResult.error || "Relay transmission rejected.");

        setButtonState(submitBtn, "success", originalBtnText);
        form.reset();
        setTimeout(() => {
          setButtonState(submitBtn, "reset", originalBtnText);
        }, 4000);
      } catch (error) {
        console.error("Relay Failure:", error);
        showFormMessage(form, "error", error.message || "Transmission error.");
        setButtonState(submitBtn, "error", originalBtnText);
        setTimeout(() => {
          setButtonState(submitBtn, "reset", originalBtnText);
        }, 3000);
      }
    });
  });
});
