"use client"

import type React from "react"
import { Sparkles, Video, Download, Users } from "lucide-react"
import { Button } from "../../button/button"
import { useTranslation } from "react-i18next"

export const PremiumSection: React.FC = () => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="premium-hero">
        <div className="premium-hero__glow" />
        <div className="premium-hero__decoration premium-hero__decoration--tl">+</div>
        <div className="premium-hero__decoration premium-hero__decoration--tr">+</div>
        <div className="premium-hero__decoration premium-hero__decoration--bl">+</div>
        <div className="premium-hero__decoration premium-hero__decoration--br">+</div>
        <div className="premium-hero__content">
          <div className="premium-hero__icon">
            <Sparkles size={48} />
          </div>
          <h2 className="premium-hero__title">{t("premium_title")}</h2>
          <p className="premium-hero__description">{t("premium_description")}</p>
        </div>
      </div>

      <div className="premium-features">
        <div className="premium-feature">
          <div className="premium-feature__icon">
            <Sparkles size={20} />
          </div>
          <div className="premium-feature__content">
            <h4>{t("premium_feature_1")}</h4>
            <p>{t("premium_feature_1_desc")}</p>
          </div>
        </div>
        <div className="premium-feature">
          <div className="premium-feature__icon">
            <Video size={20} />
          </div>
          <div className="premium-feature__content">
            <h4>{t("premium_feature_2")}</h4>
            <p>{t("premium_feature_2_desc")}</p>
          </div>
        </div>
        <div className="premium-feature">
          <div className="premium-feature__icon">
            <Download size={20} />
          </div>
          <div className="premium-feature__content">
            <h4>{t("premium_feature_3")}</h4>
            <p>{t("premium_feature_3_desc")}</p>
          </div>
        </div>
        <div className="premium-feature">
          <div className="premium-feature__icon">
            <Users size={20} />
          </div>
          <div className="premium-feature__content">
            <h4>{t("premium_feature_4")}</h4>
            <p>{t("premium_feature_4_desc")}</p>
          </div>
        </div>
      </div>

      <div className="premium-cta">
        <Button theme="primary" className="premium-cta__button">
          <Sparkles size={18} />
          {t("get_premium")}
        </Button>
        <p className="premium-cta__note">{t("premium_note")}</p>
      </div>
    </div>
  )
}
