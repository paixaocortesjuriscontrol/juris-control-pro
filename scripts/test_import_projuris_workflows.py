import unittest
from pathlib import Path
from import_projuris_workflows import prepare


class SantanderTemplatesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        folder = Path('/mnt/user-uploads')
        if not (folder / 'workflow-2.csv').exists():
            raise unittest.SkipTest('User export unavailable')
        cls.models = prepare(folder)

    def test_models_not_personal_copies(self):
        self.assertEqual(len(self.models), 22)
        self.assertEqual(len({m['source'] for m in self.models}), 22)

    def test_latest_of_com_multa(self):
        model = next(m for m in self.models if m['source'] == '4770')
        self.assertEqual(model['version'], '43')
        self.assertEqual([s['source'] for s in model['stages']], ['114678', '114679'])

    def test_inherited_deadline(self):
        stage = next(s for m in self.models for s in m['stages'] if s['source'] == '114679')
        self.assertEqual((stage['days'], stage['fatal'], stage['unit']), (8, 8, 'dias_corridos'))

    def test_cpc_deadline(self):
        stage = next(s for m in self.models for s in m['stages'] if s['source'] == '655913')
        self.assertEqual((stage['days'], stage['fatal'], stage['unit']), (14, 14, 'dias_uteis'))


if __name__ == '__main__':
    unittest.main()