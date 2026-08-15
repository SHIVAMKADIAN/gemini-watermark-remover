"""vidfill — flow-guided video inpainting for object removal (Apache-2.0).

The classical spine is importable without any GPU/model dependency; the learned
stages live behind interfaces in the flow/, masking/, and synthesis/ subpackages.
"""

from .types import Sequence

__all__ = ["Sequence", "__version__"]
__version__ = "0.1.0"
