use std::sync::Mutex;

use coldstar_rpc::rugcheck::RugCheckClient;
use coldstar_rpc::solana::SolanaClient;
use coldstar_session::SessionManager;
use coldstar_signer::SigningPipeline;

/// Global application state, lazy-initialized on coldstar_init().
pub static GLOBAL_STATE: Mutex<Option<AppState>> = Mutex::new(None);

/// Holds all backend services.
pub struct AppState {
    pub solana_client: SolanaClient,
    pub rugcheck_client: RugCheckClient,
    pub session_manager: SessionManager,
    pub signing_pipeline: SigningPipeline,
}

impl AppState {
    pub fn new(
        rpc_endpoint: &str,
        rugcheck_url: &str,
        rugcheck_key: &str,
        network: &str,
    ) -> Self {
        Self {
            solana_client: SolanaClient::new(rpc_endpoint),
            rugcheck_client: RugCheckClient::new(rugcheck_url, rugcheck_key),
            session_manager: SessionManager::new(),
            signing_pipeline: SigningPipeline::new(network),
        }
    }
}
