from abc import ABC, abstractmethod
from typing import Any, Dic
from models.document import Documen

class BaseProcessor(ABC):
    """处理器基类"""

    @abstractmethod
    def process(self, document: Document) -> Dict[str, Any]:
        """处理文档"""
        pass