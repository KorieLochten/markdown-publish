import { useEffect, useState } from "react";
import { usePluginContext } from "../../context";
import styles from "./tokenValidator.module.css";
import { Button } from "../../components";
import { Modal } from "obsidian";

interface TokenValidatorModalProps {
  modal: Modal;
}

export const TokenValidatorModal = ({ modal }: TokenValidatorModalProps) => {
  return (
    <div className={styles["token-modal"]}>
      <div>
        <h2>Integrate Medium</h2>
        <p className={styles["token-steps"]}>
          <span>
            -&gt; Go to your Medium <b>Settings</b> page.{" "}
          </span>
          <span>
            -&gt; Click on the <b>Security and apps</b> tab. On the bottom of
            the page,
          </span>
          <span>
            -&gt; Click on the <b>Integration tokens</b>. Put any name you want
            and
          </span>
          <span>
            -&gt; Click on the <b>Get token</b> button. Copy the token and paste
            it below.
          </span>
        </p>
      </div>
      <TokenInput
        onConfirm={() => {
          modal.close();
        }}
      />
    </div>
  );
};

interface TokenInputProps {
  onConfirm: () => void;
}

const TokenInput = ({ onConfirm }: TokenInputProps) => {
  const { plugin } = usePluginContext();
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(plugin.settings.token || "");
  }, []);

  const onClick = async () => {
    await plugin.services.api.validateToken(token).then(async (isHealthy) => {
      if (isHealthy) {
        plugin.settings.token = token;
        await plugin.saveSettings();
        onConfirm();
      }
    });
  };

  return (
    <div>
      <p>API Token</p>
      <div className={styles["token-input"]}>
        <input
          type="text"
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
          }}
        />
        <Button name="Confirm" style="primary" onClick={onClick} />
      </div>
    </div>
  );
};
